import nodemailer from 'nodemailer';

async function create() {
  try {
    const account = await nodemailer.createTestAccount();
    console.log('ETHEREAL_ACCOUNT_BEGIN');
    console.log(JSON.stringify({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      user: account.user,
      pass: account.pass,
      web: nodemailer.getTestMessageUrl ? 'see-per-message-url' : null
    }));
    console.log('ETHEREAL_ACCOUNT_END');
  } catch (e) {
    console.error('Failed to create ethereal account', e);
    process.exit(1);
  }
}

create();
