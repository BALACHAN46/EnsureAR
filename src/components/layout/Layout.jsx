import React, { useEffect } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

export default function Layout({ children }) {
  useEffect(() => {
    // Re-initialize theme scripts after component mounts
    if (window.initTheme) {
      window.initTheme();
    }
    
    // Initialize cursor effect now that DOM is ready
    if (window.initCursor) {
      window.initCursor();
    }

    let lastScroll = 0;

    const handleScroll = () => {
      const currentScroll = window.pageYOffset;
      const nav = document.querySelector(".header");
      const totop = document.querySelector(".totop");
      const aboutSection = document.querySelector(".ens-about-two");
      
      // Default threshold if we are on a page without the about section
      let threshold = 300;
      if (aboutSection && nav) {
        // Trigger when the bottom of the navbar reaches the top of the about section
        threshold = aboutSection.offsetTop - nav.offsetHeight;
      }
      
      // Totop button visibility: strictly based on threshold
      if (currentScroll > threshold) {
        if (totop) totop.classList.add("show");
      } else {
        if (totop) totop.classList.remove("show");
      }

      // Header visibility: based on threshold AND scroll direction
      if (currentScroll <= threshold) {
        // Always show header above the threshold
        if (nav) nav.classList.remove("top-up");
      } else {
        // Below the threshold: hide on scroll down, show on scroll up
        if (currentScroll > lastScroll) {
          // Scrolling down
          if (nav) nav.classList.add("top-up");
        } else if (currentScroll < lastScroll) {
          // Scrolling up
          if (nav) nav.classList.remove("top-up");
        }
      }

      lastScroll = currentScroll <= 0 ? 0 : currentScroll;
    };

    window.addEventListener("scroll", handleScroll);
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
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
