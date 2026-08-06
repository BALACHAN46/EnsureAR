import React from 'react';
import { loadSiteContentConfig } from '../../utils/siteContentConfig';

export default function Footer() {
  const config = loadSiteContentConfig();
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
                            <li><a href={config.socialMedia.facebook} className="bi bi-facebook"></a></li>
                            <li><a href={config.socialMedia.instagram} className="bi bi-instagram"></a></li>
                            <li><a href={config.socialMedia.linkedin} className="bi bi-linkedin"></a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </footer>
  );
}
