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
const GMAIL_EMAIL = "fuma09944@gmail.com";

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
          user: GMAIL_EMAIL,
          pass: GMAIL_PASSWORD.value(),
        },
      });

      // 宛先は送信元と同じでもOK（複数ならカンマ区切り、または配列）
      const bcc = "xjgnd72@gmail.com";

      const subject = `Alert:/aws/lambda/ProdMainStack-CustomS3AutoDeleteObjectsC-bIDm1yjCE7TT`;
      const textBody =
        `5655d0a0-9d1c-411b-81b0-71ffdc294f36	INFO	submit response to cloudformation {
  Status: 'SUCCESS',
  Reason: 'SUCCESS',
  StackId: 'arn:aws:cloudformation:ap-northeast-1:805632007358:stack/ProdMainStack/831bd4f0-73dd-11ee-b128-0e10767c3f4f',
  RequestId: 'ecb44a55-a9bd-4ce9-81a9-3a62490bd676',
  PhysicalResourceId: 'a2e62558-26a8-46f4-a1ed-5b468f30f56a',
  LogicalResourceId: 'Ec2WebApAlbLogBucketAutoDeleteObjectsCustomResource9C10CD93',
  NoEcho: undefined,
  Data: undefined
}`

      await transporter.sendMail({
        from: `<Google Firebase>`,
        bcc,
        subject,
        text: textBody,
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