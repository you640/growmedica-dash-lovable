import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Copy, RefreshCw, Download } from "lucide-react";
import { GlassPanel } from "./AdminShell";
import {
  getWpSyncStatus,
  backfillWordPressContent,
  backfillWooCommerce,
  type SyncStatus,
} from "@/lib/wp-data.functions";
import { listRecentWebhookEvents } from "@/lib/admin.functions";

function snippet(endpoint: string) {
  return `<?php
/**
 * Plugin Name: GrowMedica Relay
 * Description: Posiela WordPress a WooCommerce udalosti do GrowMedica Admin.
 * Nahrajte ako wp-content/mu-plugins/growmedica-relay.php
 */
if (!defined('ABSPATH')) exit;

define('GM_RELAY_URL', '${endpoint}');
define('GM_RELAY_SECRET', 'SEM_VLOZTE_WORDPRESS_WEBHOOK_SECRET');

function gm_relay_send($topic, $data) {
  $body = wp_json_encode(array(
    'topic' => $topic,
    'timestamp' => time(),
    'site' => home_url(),
    'data' => $data,
  ));
  $sig = hash_hmac('sha256', $body, GM_RELAY_SECRET);
  wp_remote_post(GM_RELAY_URL, array(
    'timeout' => 8,
    'blocking' => false,
    'headers' => array('Content-Type' => 'application/json', 'X-GM-Signature' => $sig),
    'body' => $body,
  ));
}

function gm_relay_post_payload($post) {
  return array(
    'id' => $post->ID,
    'title' => get_the_title($post),
    'slug' => $post->post_name,
    'status' => $post->post_status,
    'link' => get_permalink($post),
    'excerpt' => wp_strip_all_tags(get_the_excerpt($post)),
    'image_url' => get_the_post_thumbnail_url($post, 'medium'),
    'author' => get_the_author_meta('display_name', $post->post_author),
    'date' => get_post_time('c', true, $post),
    'modified' => get_post_modified_time('c', true, $post),
  );
}

add_action('transition_post_status', function ($new, $old, $post) {
  $type = $post->post_type;
  $entity = $type === 'page' ? 'page' : ($type === 'product' ? 'product' : ($type === 'post' ? 'post' : null));
  if (!$entity) return;
  $action = $new === 'publish' && $old !== 'publish' ? 'published' : ($new === 'trash' ? 'trashed' : 'updated');
  $payload = gm_relay_post_payload($post);
  if ($entity === 'product' && function_exists('wc_get_product')) {
    $p = wc_get_product($post->ID);
    if ($p) {
      $payload['price'] = $p->get_price();
      $payload['stock_status'] = $p->get_stock_status();
      $payload['stock_quantity'] = $p->get_stock_quantity();
    }
  }
  gm_relay_send($entity . '.' . $action, $payload);
}, 10, 3);

add_action('before_delete_post', function ($id) {
  $post = get_post($id);
  if (!$post) return;
  $type = $post->post_type === 'page' ? 'page' : ($post->post_type === 'product' ? 'product' : 'post');
  gm_relay_send($type . '.deleted', array('id' => $id));
});

add_action('add_attachment', function ($id) {
  gm_relay_send('media.uploaded', array(
    'id' => $id,
    'title' => get_the_title($id),
    'source_url' => wp_get_attachment_url($id),
    'alt_text' => get_post_meta($id, '_wp_attachment_image_alt', true),
    'link' => get_permalink($id),
    'modified' => current_time('c', true),
  ));
});
add_action('delete_attachment', function ($id) { gm_relay_send('media.deleted', array('id' => $id)); });

function gm_relay_order($order_id) {
  if (!function_exists('wc_get_order')) return;
  $o = wc_get_order($order_id);
  if (!$o) return;
  gm_relay_send('order.updated', $o->get_data());
}
add_action('woocommerce_new_order', function ($id) {
  if (!function_exists('wc_get_order')) return;
  $o = wc_get_order($id);
  if ($o) gm_relay_send('order.created', $o->get_data());
});
add_action('woocommerce_update_order', 'gm_relay_order');
add_action('woocommerce_order_status_changed', function ($id) { gm_relay_order($id); });

add_action('woocommerce_created_customer', function ($id) {
  $u = get_userdata($id);
  if (!$u) return;
  gm_relay_send('customer.created', array(
    'id' => $id,
    'email' => $u->user_email,
    'username' => $u->user_login,
    'first_name' => get_user_meta($id, 'first_name', true),
    'last_name' => get_user_meta($id, 'last_name', true),
    'date_created' => $u->user_registered,
  ));
});

add_action('activated_plugin', function ($plugin) { gm_relay_send('plugin.activated', array('plugin' => $plugin)); });
add_action('deactivated_plugin', function ($plugin) { gm_relay_send('plugin.deactivated', array('plugin' => $plugin)); });
add_action('upgrader_process_complete', function ($u, $opts) {
  if (($opts['type'] ?? '') !== 'plugin') return;
  foreach (($opts['plugins'] ?? array()) as $plugin) {
    gm_relay_send('plugin.updated', array('plugin' => $plugin));
  }
}, 10, 2);
`;
}

type EventRow = {
  id: string;
  source: string;
  topic: string;
  status: string;
  error: string | null;
  created_at: string;
};

export function WpRelayCard() {
  const statusFn = useServerFn(getWpSyncStatus);
  const backfillFn = useServerFn(backfillWordPressContent);
  const wooFn = useServerFn(backfillWooCommerce);
  const eventsFn = useServerFn(listRecentWebhookEvents);

  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [wooBusy, setWooBusy] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState("");

  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/public/webhooks/wordpress`);
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const [s, e] = await Promise.all([statusFn(), eventsFn()]);
      setStatus(s);
      setEvents((e.events as EventRow[]).filter((r) => r.source === "wordpress").slice(0, 15));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runBackfill() {
    setImporting(true);
    try {
      const r = await backfillFn();
      if (r.ok) toast.success(`Importovaných záznamov: ${r.imported}`);
      else toast.error(r.error ?? "Import zlyhal.");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} skopírované.`);
    } catch {
      toast.error("Kopírovanie zlyhalo.");
    }
  }

  async function runWoo(kinds: Array<"products" | "orders" | "customers">, label: string) {
    setWooBusy(label);
    try {
      const r = await wooFn({ data: { kinds } });
      for (const p of r.parts) {
        if (p.error) toast.error(`${p.kind}: ${p.error}`);
        else if (p.note) toast.info(`${p.kind}: ${p.note}`);
        else toast.success(`${p.kind}: ${p.imported} záznamov`);
      }
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setWooBusy(null);
    }
  }

  const c = status?.counts;

  return (
    <GlassPanel className="p-6 space-y-6">
      <div>
        <h3 className="text-base font-semibold">Webhook relay → databáza</h3>
        <p className="text-sm text-gm-text-muted mt-1 max-w-2xl">
          Publikačné udalosti z WordPressu a WooCommerce (príspevky, stránky, médiá, produkty,
          objednávky, zákazníci, pluginy) sa podpísané pošlú na tento endpoint a okamžite
          aktualizujú záznamy v databáze.
        </p>
      </div>

      <div className="space-y-2 text-sm">
        <div className="text-xs uppercase tracking-wider text-gm-text-muted">Endpoint</div>
        <div className="flex gap-2 items-center">
          <code className="flex-1 truncate rounded-md border border-gm-border bg-gm-bg-soft px-3 py-2 font-mono text-xs">
            {endpoint || "—"}
          </code>
          <button
            onClick={() => copy(endpoint, "URL")}
            className="rounded-full border border-gm-border px-3 py-2 text-xs hover:bg-gm-bg-soft inline-flex items-center gap-1"
          >
            <Copy className="w-3.5 h-3.5" /> Kopírovať
          </button>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Chip
            ok={!!status?.secretConfigured}
            label={
              status?.secretConfigured
                ? "WORDPRESS_WEBHOOK_SECRET nastavený"
                : "Chýba WORDPRESS_WEBHOOK_SECRET"
            }
          />
          <Chip
            ok={!!status?.connectorConnected}
            label={status?.connectorConnected ? "Konektor pripojený" : "Konektor nepripojený"}
          />
          <Chip
            ok={!!status?.bffConfigured}
            label={
              status?.bffConfigured
                ? "Storefront API nastavené"
                : "Chýba STOREFRONT_BFF_BASE_URL / DASHBOARD_AGENT_SECRET"
            }
          />
          {status?.lastEventAt && (
            <span className="rounded-full bg-gm-bg-soft px-3 py-1 text-xs text-gm-text-muted">
              Posledná udalosť: {new Date(status.lastEventAt).toLocaleString("sk-SK")}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => copy(snippet(endpoint), "Snippet")}
          className="rounded-full bg-gm-primary text-white px-5 py-2 text-sm hover:opacity-90 inline-flex items-center gap-2"
        >
          <Copy className="w-4 h-4" /> Kopírovať mu-plugin snippet
        </button>
        <button
          onClick={runBackfill}
          disabled={importing}
          className="rounded-full border border-gm-border bg-white px-5 py-2 text-sm hover:bg-gm-bg-soft disabled:opacity-50 inline-flex items-center gap-2"
        >
          {importing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Načítať existujúci obsah
        </button>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-full border border-gm-border bg-white px-5 py-2 text-sm hover:bg-gm-bg-soft disabled:opacity-50 inline-flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Obnoviť
        </button>
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-gm-text-muted">
          WooCommerce backfill
        </div>
        <div className="flex flex-wrap gap-2">
          <WooBtn
            busy={wooBusy === "products"}
            disabled={!!wooBusy}
            onClick={() => runWoo(["products"], "products")}
          >
            Načítať produkty
          </WooBtn>
          <WooBtn
            busy={wooBusy === "orders"}
            disabled={!!wooBusy}
            onClick={() => runWoo(["orders"], "orders")}
          >
            Načítať objednávky
          </WooBtn>
          <WooBtn
            busy={wooBusy === "customers"}
            disabled={!!wooBusy}
            onClick={() => runWoo(["customers"], "customers")}
          >
            Načítať zákazníkov
          </WooBtn>
          <WooBtn
            busy={wooBusy === "all"}
            disabled={!!wooBusy}
            onClick={() => runWoo(["products", "orders", "customers"], "all")}
            primary
          >
            Načítať všetko
          </WooBtn>
        </div>
        <p className="text-xs text-gm-text-muted max-w-2xl">
          Produkty sa načítajú z WordPress REST API cez konektor a doplnia sa o živé ceny a sklad zo
          storefront API. Objednávky a zákazníci prichádzajú zo storefront API (zákazníci sa odvodia
          z e-mailov v objednávkach).
        </p>
      </div>

      {c && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Príspevky" value={c.post} />
          <Stat label="Stránky" value={c.page} />
          <Stat label="Médiá" value={c.media} />
          <Stat label="Produkty" value={c.product} />
          <Stat label="Objednávky" value={c.order} />
          <Stat label="Zákazníci" value={c.customer} />
          <Stat label="Pluginy" value={c.plugin} />
        </div>
      )}

      <div>
        <div className="text-sm font-medium mb-2">Posledné prijaté udalosti</div>
        {events.length === 0 ? (
          <div className="text-sm text-gm-text-muted">
            Zatiaľ žiadne. Vložte snippet do WordPressu a publikujte obsah.
          </div>
        ) : (
          <div className="overflow-auto rounded-md border border-gm-border">
            <table className="w-full text-xs">
              <thead className="bg-gm-bg-soft text-gm-text-muted">
                <tr>
                  <th className="text-left px-3 py-2">Čas</th>
                  <th className="text-left px-3 py-2">Topic</th>
                  <th className="text-left px-3 py-2">Stav</th>
                  <th className="text-left px-3 py-2">Chyba</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-gm-border">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString("sk-SK")}
                    </td>
                    <td className="px-3 py-2 font-mono">{e.topic}</td>
                    <td
                      className={`px-3 py-2 ${e.status === "failed" ? "text-red-600" : "text-green-600"}`}
                    >
                      {e.status}
                    </td>
                    <td className="px-3 py-2 text-gm-text-muted">{e.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs ${
        ok ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-700"
      }`}
    >
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-gm-border px-3 py-2">
      <div className="text-xs text-gm-text-muted">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
