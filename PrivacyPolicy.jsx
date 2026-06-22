import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Privacy Policy</h1>
      <p style={styles.text}><strong>Effective Date:</strong> {new Date().toLocaleDateString()}</p>

      <p style={styles.text}>
        Welcome to the Always With You App ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application.
      </p>

      <h2 style={styles.subheading}>1. Information We Collect</h2>
      <p style={styles.text}>
        To provide you with the best possible diary experience, we collect the following types of information:
      </p>
      <ul style={styles.list}>
        <li><strong>Personal Information:</strong> If you create an account, we may collect your name, email address, and authentication credentials.</li>
        <li><strong>User Content:</strong> The diary entries, text, and media (such as images) that you upload to the application.</li>
        <li><strong>Usage Data & Analytics:</strong> We collect diagnostic and performance data, including crash reports, app performance metrics, and general usage statistics to improve the app's stability.</li>
      </ul>

      <h2 style={styles.subheading}>2. How We Use Your Information</h2>
      <p style={styles.text}>
        We use the information we collect primarily to provide, maintain, and improve our services. Specifically, your data is used to:
      </p>
      <ul style={styles.list}>
        <li>Securely store and retrieve your personal diary entries.</li>
        <li>Synchronize your data across your devices.</li>
        <li>Monitor application performance and resolve technical issues.</li>
      </ul>

      <h2 style={styles.subheading}>3. Third-Party Services (Google Firebase)</h2>
      <p style={styles.text}>
        Our application uses Google Firebase to provide backend infrastructure. By using our app, your data is securely processed and stored via the following Firebase services:
      </p>
      <ul style={styles.list}>
        <li><strong>Firebase Firestore & Storage:</strong> Used to securely host your diary text and media files.</li>
        <li><strong>Firebase Authentication:</strong> Used to securely manage your account and login state.</li>
        <li><strong>Firebase Analytics & Performance:</strong> Used to collect anonymous usage and crash data to help us improve the application.</li>
      </ul>
      <p style={styles.text}>
        For more information on how Google handles data, please review the <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={styles.link}>Google Privacy Policy</a>.
      </p>

      <h2 style={styles.subheading}>4. Data Security</h2>
      <p style={styles.text}>
        We implement industry-standard security measures to protect your personal information and diary entries. While we strive to use commercially acceptable means (such as encryption and secure cloud infrastructure) to protect your personal data, we cannot guarantee its absolute security over the internet.
      </p>

      <h2 style={styles.subheading}>5. Changes to This Privacy Policy</h2>
      <p style={styles.text}>
        We may update our Privacy Policy from time to time. We will notify you of any changes by updating the "Effective Date" at the top of this page. You are advised to review this Privacy Policy periodically for any changes.
      </p>

      <h2 style={styles.subheading}>6. Contact Us</h2>
      <p style={styles.text}>
        If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact us at <strong>kumaranup2k2@gmail.com</strong>.
      </p>
    </div>
  );
};

const styles = {
  container: {
    padding: '0 10px 40px 10px',
    maxWidth: '720px',
    margin: '0 auto',
    fontFamily: 'inherit',
    lineHeight: '1.75',
    color: 'var(--text-color)',
    opacity: 0.92
  },
  heading: {
    fontSize: '1.7rem',
    borderBottom: '1px solid var(--input-border)',
    paddingBottom: '12px',
    marginBottom: '24px',
    color: 'var(--accent)'
  },
  subheading: {
    fontSize: '1.25rem',
    marginTop: '32px',
    marginBottom: '12px',
    color: 'var(--accent2)'
  },
  text: { fontSize: '0.92rem', marginBottom: '14px' },
  list: { marginLeft: '20px', marginBottom: '14px', fontSize: '0.92rem' },
  link: { color: 'var(--accent)', textDecoration: 'none', fontWeight: '500', opacity: 1 }
};

export default PrivacyPolicy;