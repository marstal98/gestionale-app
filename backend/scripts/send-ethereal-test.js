import dotenv from 'dotenv';
dotenv.config();

import mailer from '../src/utils/mailer.js';
import nodemailer from 'nodemailer';

async function main() {
  const to = process.env.TEST_TO || 'marcostallone.developer@gmail.com';
  const subject = 'GestioNexus - Email di prova';
  const text = 'Ciao, questa è una email di prova inviata da GestioNexus tramite Ethereal.';
  try {
    const info = await mailer.sendMail({ to, subject, text });
    console.log('sendMail returned info:');
    console.log(info);
    const preview = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
    console.log('Preview URL:', preview);
  } catch (e) {
    console.error('Errore invio mail di prova:', e);
    process.exitCode = 1;
  }
}

main();
