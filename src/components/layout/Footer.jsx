import React, { useState, useEffect } from 'react';
import { loadSiteContentConfig, DEFAULT_CONFIG } from '../../utils/siteContentConfig';

export default function Footer() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  useEffect(() => { loadSiteContentConfig().then(setConfig); }, []);
  const year = new Date().getFullYear();
  return (
    <footer className="footer style1 bg-image-2" style={{ backgroundImage: "url('/img/background/bg-5.png')" }}>
        <div className="footer-bottom">
            <div className="container">
                <div className="footer-bottom-inner">
                    <div className="copyright">
                        <p>© Copyright {year}. All Rights Reserved by <a href="https://ensurear.com/">ENSUREAR</a> | <a href="/privacy">Privacy Policy</a></p>
                    </div>
                    <div className="social-box style-oval">
                        <ul>
                            <li><a href={config.socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="bi bi-facebook"></a></li>
                            <li><a href={config.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="bi bi-instagram"></a></li>
                            <li><a href={config.socialMedia.linkedin} target="_blank" rel="noopener noreferrer" className="bi bi-linkedin"></a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </footer>
  );
}
