/**
 * chat-functions/index.js
 * Node.js 20 / firebase-functions v7 対応
 * - params: defineString / defineSecret を使用（functions.config() は v7 で廃止）
 * - Firestore onCreate トリガーで Gmail 宛に通知メールを送信
 */

'use strict';

// v2 Firestore トリガー
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
// params（環境パラメータ／Secrets）
const { defineString, defineSecret } = require('firebase-functions/params');
// ロガー（任意）
const { logger } = require('firebase-functions');
// Admin 初期化（Storage/Firestore/認証など利用する可能性に備え）
const { initializeApp } = require('firebase-admin/app');

// メール送信
const nodemailer = require('nodemailer');

// ---- Firebase Admin を初期化 ----
initializeApp();

// ---- params / secrets ----
// 平文（.env で設定）：送信元 Gmail アドレス
//   chat-functions/.env 例:
//     GMAIL_EMAIL=youraddress@gmail.com
const GMAIL_EMAIL = defineString('GMAIL_EMAIL');

// 機密（Secret Manager で設定）：Gmail アプリパスワード（16桁）
//   設定コマンド： firebase functions:secrets:set GMAIL_PASSWORD
const GMAIL_PASSWORD = defineSecret('GMAIL_PASSWORD');

// ---- 共通設定（必要に応じて調整） ----
const REGION = 'asia-northeast1';         // Firestore と同一リージョン推奨
const TIMEOUT_SECONDS = 30;               // タイムアウト（秒）
const MEMORY = '256MiB';                  // メモリ（必要なら増やす）

/**
 * Firestore: messages/{messageId} に新規作成 → Gmail に通知メール送信
 */
exports.notifyNewMessage = onDocumentCreated(
  {
    document: 'messages/{messageId}',
    region: REGION,
    timeoutSeconds: TIMEOUT_SECONDS,
    memory: MEMORY,
    secrets: [GMAIL_PASSWORD], // Secret を関数にマウント
  },
  /**
   * @param {import('firebase-functions/v2/firestore').FirestoreEvent<import('firebase-admin/firestore').DocumentSnapshot>} event
   */
  async (event) => {
    try {
      const snap = event.data;                          // DocumentSnapshot
      if (!snap) {
        logger.warn('[notifyNewMessage] No snapshot received');
        return;
      }

      const data = snap.data() || {};
      const name = data.name || '匿名';
      const text = data.message || '';
      const when =
        (data.timestamp && data.timestamp.toDate && data.timestamp.toDate()) ||
        new Date();

      // ---- nodemailer transporter を毎回生成（Secret を value() で取得）----
      // Secrets は runtime で value() から参照。
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: GMAIL_EMAIL.value(),
          pass: GMAIL_PASSWORD.value(),
        },
      });

      // 宛先は送信元と同じでもOK（複数ならカンマ区切り、または配列）
      const to = GMAIL_EMAIL.value();

      const subject = `【新着メッセージ】${name} さんから`;
      const textBody =
        `新着メッセージが投稿されました。\n\n` +
        `--- 投稿内容 ---\n` +
        `名前: ${name}\n` +
        `本文:\n${text}\n\n` +
        `投稿時刻: ${when.toLocaleString('ja-JP', { hour12: false })}\n`;

      // HTML（任意）
      const htmlBody = `
        <div style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans JP', 'Helvetica Neue', Arial, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'">
          <h3>新着メッセージ</h3>
          <table style="border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding:4px 8px; color:#666;">名前</td>
              <td style="padding:4px 8px;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px; color:#666;">投稿時刻</td>
              <td style="padding:4px 8px;">${escapeHtml(
                when.toLocaleString('ja-JP', { hour12: false })
              )}</td>
            </tr>
          </table>
          <div style="margin-top:12px; padding:8px; background:#f7f7f7; white-space:pre-wrap; border:1px solid #eee;">
            ${escapeHtml(text)}
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `EasyChat 通知 <${GMAIL_EMAIL.value()}>`,
        to,
        subject,
        text: textBody,
        html: htmlBody,
      });

      logger.info('[notifyNewMessage] mail sent', {
        msgId: event.params?.messageId,
        to,
      });
    } catch (err) {
      logger.error('[notifyNewMessage] failed', err);
      // 失敗を再試行させたい場合は throw する（最大再試行回数は GCF 側に依存）
      // throw err;
    }
  }
);

/**
 * HTML エスケープ（最小限）
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}