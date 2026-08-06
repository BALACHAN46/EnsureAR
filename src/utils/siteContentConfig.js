/**
 * siteContentConfig.js
 * ----------------
 * Manages Site Content configuration stored in localStorage.
 */

const STORAGE_KEY = 'site_content_config';

export const DEFAULT_CONFIG = {
  aboutEnsureAR: {
    title: "About EnsureAR",
    landingSubtitle: "Your Perfect Fit, Ensured by EnsureAR",
    text1: "EnsureAR is a cutting-edge AR technology company that delivers immersive Virtual Try-On solutions for jewellery, watches, and eyewear - empowering customers to visualize products in real time, shop with confidence, and experience a seamless blend of style and technology. With advanced precision and realistic rendering, our solutions bring every detail to life.",
    text2: "We help brands enhance customer engagement, boost conversions, and redefine the future of digital shopping."
  },
  vision: "To be the world's leader in immersive augmented reality solutions that empower individuals and businesses to visualize, interact, and transform their ideas into reality.",
  mission: "EnsureAR delivers cutting-edge AR experiences through state-of-the-art technology, creative design, and seamless integration - enabling clients to enhance engagement, improve understanding, and drive innovation in every interaction.",
  whyChooseUs: "Cutting-Edge AR Technology - Advanced and realistic virtual try-on solutions for jewellery, watches, and eyewear.<br/><br/>Enhanced Customer Experience - Helps shoppers make confident purchase decisions with immersive product visualization.<br/><br/>Boost Conversions - Proven to increase customer engagement and sales for brands.<br/><br/>Seamless Integration - Easy-to-deploy solutions tailored to your business needs.",
  testimonial: {
    name: "Jackson",
    location: "New York",
    text: "Trying jewellery virtually before buying gave me complete confidence. The AR experience felt so real that I could see how it looked on me without stepping into the store."
  },
  contact: {
    address: "4180 Morgan Elizabeth Way, Cumming, GA - 30041, USA",
    phone: "+1 (762) 422 3803",
    email: "info@ensurear.com"
  },
  socialMedia: {
    facebook: "https://www.facebook.com/EnsureAR/",
    instagram: "https://www.instagram.com/ensure_ar/",
    linkedin: "https://www.linkedin.com/in/ensure-ar"
  },
  virtualTryOnMenu: [
    {
      id: 'menu-1',
      label: 'Diamond Jewellery',
      children: [
        { id: 'sub-1-1', label: 'Necklaces', targetCategory: 'necklace' },
        { id: 'sub-1-2', label: 'Chains', targetCategory: 'necklace' },
        { id: 'sub-1-3', label: 'Earrings', targetCategory: 'earrings' },
        { id: 'sub-1-4', label: 'Nosepin', targetCategory: 'nosepin' },
        { id: 'sub-1-5', label: 'Sets', targetCategory: 'necklace' },
        { id: 'sub-1-6', label: 'Bracelets', targetCategory: 'bracelets' },
        { id: 'sub-1-7', label: 'Rings', targetCategory: 'rings' },
        { id: 'sub-1-8', label: 'Bangles', targetCategory: 'bracelets' }
      ]
    },
    {
      id: 'menu-2',
      label: 'Gold Jewellery',
      children: [
        { id: 'sub-2-1', label: 'Necklaces', targetCategory: 'necklace' },
        { id: 'sub-2-2', label: 'Chains', targetCategory: 'necklace' },
        { id: 'sub-2-3', label: 'Earrings', targetCategory: 'earrings' },
        { id: 'sub-2-4', label: 'Nosepin', targetCategory: 'nosepin' },
        { id: 'sub-2-5', label: 'Sets', targetCategory: 'necklace' },
        { id: 'sub-2-6', label: 'Bracelets', targetCategory: 'bracelets' },
        { id: 'sub-2-7', label: 'Rings', targetCategory: 'rings' },
        { id: 'sub-2-8', label: 'Bangles', targetCategory: 'bracelets' }
      ]
    },
    {
      id: 'menu-3',
      label: 'Eyewears',
      targetCategory: 'eyewear',
      children: []
    },
    {
      id: 'menu-4',
      label: 'Watches',
      targetCategory: 'watch',
      children: []
    }
  ]
};

export function loadSiteContentConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveSiteContentConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export function resetSiteContentConfig() {
  localStorage.removeItem(STORAGE_KEY);
}
