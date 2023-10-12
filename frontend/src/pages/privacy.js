import React from 'react';

const containerStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100vh', // This ensures that the content takes up the full height of the viewport
};

const pageStyle = {
  maxWidth: '800px',
  padding: '20px',
  backgroundColor: '#f9f9f9', // Light background color
  borderRadius: '8px',
  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)', // Box shadow for a card-like effect
};

const headingStyle = {
  color: '#4255ff',
};

const accentColor = '#4255ff'; // Use the main color for accents

const accentTextStyle = {
  color: accentColor,
};

const PrivacyPage = () => {
  return (
    <div style={containerStyle}>
      <div style={pageStyle}>
        <h1 style={{ ...headingStyle, borderBottom: `3px solid ${accentColor}` }}>
          Privacy Policy
        </h1>

        <h2 style={accentTextStyle}>Permissions and Data Usage</h2>

        <h3 style={accentTextStyle}>Host Permission</h3>
        <p>
          The extension requires host permission to listen for user-selected words and provide seamless translation functionality. By accessing the content of the web page, the extension can detect when a user selects a word and initiate the translation process. This permission enables the extension to retrieve the selected word, perform the necessary translation operations, and present the translated result to the user without interrupting their browsing experience. By seamlessly integrating with the website's content, the extension enhances language comprehension and facilitates efficient translation for improved user productivity and understanding.
        </p>

        <h3 style={accentTextStyle}>Storage Access</h3>
        <p>
          The extension also requires storage access to securely store the user token after they log in. This token is essential for maintaining a persistent login session and ensuring a seamless user experience within the extension.
        </p>

        <h2 style={accentTextStyle}>How Your Data is Used</h2>

        <p>
          Our extension helps with quick translation when you're using the web and encounter words you don't know. It allows you to take notes on unfamiliar words.
        </p>

        <h2 style={accentTextStyle}>Security</h2>
        <p>
          We take the security and privacy of your data seriously. Your user token is securely stored to provide a seamless experience, and the extension does not collect or share any personal information.
        </p>

        <h2 style={accentTextStyle}>Contact Us</h2>
        <p>
          If you have any questions or concerns regarding your privacy or the use of our extension, please contact us at <a href="mailto:ngovdong19@gmail.com" style={{ color: accentColor }}>ngovdong19@gmail.com</a>.
        </p>

        <p>
          This privacy policy was last updated on Oct 12, 2023.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPage;
