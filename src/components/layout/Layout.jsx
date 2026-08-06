import React, { useEffect } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

export default function Layout({ children }) {
  useEffect(() => {
    // Re-initialize theme scripts after component mounts
    if (window.initTheme) {
      window.initTheme();
    }
  }, []);

  return (
    <>
      <div id="preloader">
          <div className="preloader-inner">
              <img src="/img/EnsureAR.png" alt="img" />
          </div>
      </div>

      <div className="pointer bnz-pointer" id="bnz-pointer"></div>

      <Navbar />

      <div id="formMessageContact"></div>

      <main className="wrapper">
          {children}
      </main>

      <Footer />

      <div className="totop">
          <a href="#"><i className="bi bi-chevron-up"></i></a>
      </div>
    </>
  );
}
