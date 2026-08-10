/**
 * siteContentConfig.js
 * ----------------
 * Site content (About/Vision/Mission/Contact/Social/Testimonials) — backed
 * by the real API (Modules/Admin) instead of localStorage.
 *
 * The "Virtual Try-On" menu (parent/child categories) is a separate concern
 * now served by services/categoriesApi.js (Modules/Categories) — see
 * Navbar.jsx, UploadPage.jsx, AdminMenuSettingsPage.jsx.
 */

import { getSiteSettings, updateSiteSettings, getTestimonials, createTestimonial, updateTestimonial, deleteTestimonial } from '../services/adminApi';

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
  testimonials: [],
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
};

export async function loadSiteContentConfig() {
  try {
    const [settings, testimonials] = await Promise.all([
      getSiteSettings(),
      getTestimonials(),
    ]);

    return {
      aboutEnsureAR: {
        title: settings.aboutTitle || DEFAULT_CONFIG.aboutEnsureAR.title,
        landingSubtitle: settings.aboutSubtitle || DEFAULT_CONFIG.aboutEnsureAR.landingSubtitle,
        text1: settings.aboutText1 || DEFAULT_CONFIG.aboutEnsureAR.text1,
        text2: settings.aboutText2 || DEFAULT_CONFIG.aboutEnsureAR.text2,
      },
      vision: settings.vision || DEFAULT_CONFIG.vision,
      mission: settings.mission || DEFAULT_CONFIG.mission,
      whyChooseUs: settings.whyChooseUs || DEFAULT_CONFIG.whyChooseUs,
      testimonials: testimonials.map(t => ({
        id: t.testimonialId,
        name: t.name,
        location: t.location || '',
        text: t.quote,
        rating: t.rating,
      })),
      contact: {
        address: settings.contactAddress || DEFAULT_CONFIG.contact.address,
        phone: settings.contactPhone || DEFAULT_CONFIG.contact.phone,
        email: settings.contactEmail || DEFAULT_CONFIG.contact.email,
      },
      socialMedia: {
        facebook: settings.facebookUrl || DEFAULT_CONFIG.socialMedia.facebook,
        instagram: settings.instagramUrl || DEFAULT_CONFIG.socialMedia.instagram,
        linkedin: settings.linkedinUrl || DEFAULT_CONFIG.socialMedia.linkedin,
      },
    };
  } catch (err) {
    console.warn('Could not load site content, using defaults.', err);
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveSiteContentConfig(config) {
  try {
    await updateSiteSettings({
      aboutTitle: config.aboutEnsureAR?.title,
      aboutSubtitle: config.aboutEnsureAR?.landingSubtitle,
      aboutText1: config.aboutEnsureAR?.text1,
      aboutText2: config.aboutEnsureAR?.text2,
      vision: config.vision,
      mission: config.mission,
      whyChooseUs: config.whyChooseUs,
      contactAddress: config.contact?.address,
      contactPhone: config.contact?.phone,
      contactEmail: config.contact?.email,
      facebookUrl: config.socialMedia?.facebook,
      instagramUrl: config.socialMedia?.instagram,
      linkedinUrl: config.socialMedia?.linkedin,
    });

    await saveTestimonials(config.testimonials || []);
    return true;
  } catch (err) {
    console.warn('Could not save site content.', err);
    return false;
  }
}

/** Diffs the edited testimonial list against what's currently saved: creates new ones (no id yet), updates existing ones, deletes any that were removed. */
async function saveTestimonials(testimonials) {
  const existing = await getTestimonials({ includeInactive: true });
  const keptIds = new Set(testimonials.filter(t => t.id).map(t => t.id));

  await Promise.all([
    ...existing.filter(t => !keptIds.has(t.testimonialId)).map(t => deleteTestimonial(t.testimonialId)),
    ...testimonials.map((t, index) => {
      const payload = { name: t.name, location: t.location, quote: t.text, rating: t.rating, displayOrder: index, isActive: true };
      return t.id ? updateTestimonial(t.id, payload) : createTestimonial(payload);
    }),
  ]);
}
