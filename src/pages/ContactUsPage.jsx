import React, { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { loadSiteContentConfig, DEFAULT_CONFIG } from '../utils/siteContentConfig';

export default function ContactUsPage() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState({ loading: false, message: '', isError: false });

  useEffect(() => { loadSiteContentConfig().then(setConfig); }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, message: '', isError: false });
    
    try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/contact/inquiry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await response.json();
        
        if (response.ok) {
            setStatus({ loading: false, message: 'Your enquiry has been sent successfully.', isError: false });
            setFormData({ name: '', email: '', subject: '', message: '' });
        } else {
            setStatus({ loading: false, message: data.message || 'Failed to send enquiry.', isError: true });
        }
    } catch (err) {
        setStatus({ loading: false, message: 'An error occurred. Please try again later.', isError: true });
    }
  };

  return (
    <Layout>

<section className="ens-contact-form bg-image-5" style={{ backgroundImage: `url('/../assets/img/background/bg-9.jpg')` }}>
    <div className="container">
        <div className="ens-form--wrapper no-bg">
            <div className="row">
                <div className="col-lg-5">
                    <div className="ens-heading">
                        <div className="ens-item--inner">
                            <h6 className="ens-item--subtitle"> Contact Us</h6>
                        </div>
                    </div>
                    <div className="widget">
                        <div className="ens-office">
                            <div className="ens-item--inner">
                                <div className="ens-item--subtitle">
                                    Address
                                </div>
                                <h5 className="ens-item--title">{config.contact.address}</h5>
                            </div>
                        </div>
                        <div className="ens-office">
                            <div className="ens-item--inner">
                                <div className="ens-item--subtitle">
                                    Call Us For Query
                                </div>
                                <h5 className="ens-item--title"><a href={`tel:${config.contact.phone.replace(/[^0-9+]/g, '')}`}>{config.contact.phone}</a></h5>
                            </div>
                        </div>

                        <div className="ens-office">
                            <div className="ens-item--inner">
                                <div className="ens-item--subtitle">
                                    SEND US EMAIL
                                </div>
                                <h5 className="ens-item--title"><a href={`mailto:${config.contact.email}`}>{config.contact.email}</a></h5>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-7">
                    <form className="ens-form--inner" onSubmit={handleSubmit}>
                        <div className="row">
                            <div className="col-lg-6 col-md-6 mb-4">
                                <div className="form-group">
                                    <input type="text" name="name" value={formData.name} onChange={handleChange} className="form-control" placeholder="Name*" required />
                                </div>
                            </div>

                            <div className="col-lg-6 col-md-6 mb-4">
                                <div className="form-group">
                                    <input type="email" name="email" value={formData.email} onChange={handleChange} className="form-control" placeholder="E-mail*" required />
                                </div>
                            </div>

                            <div className="col-lg-12 col-md-12 mb-4">
                                <div className="form-group">
                                    <input type="text" name="subject" value={formData.subject} onChange={handleChange} className="form-control" placeholder="Subject" />
                                </div>
                            </div>

                            <div className="col-md-12 col-lg-12 mb-4">
                                <div className="form-group">
                                    <textarea name="message" value={formData.message} onChange={handleChange} className="form-control" placeholder="Text"></textarea>
                                </div>
                            </div>

                            <div className="col-md-12 col-lg-12">
                                {status.message && (
                                    <div className={`alert ${status.isError ? 'alert-danger' : 'alert-success'} mb-3`}>
                                        {status.message}
                                    </div>
                                )}
                                <div className="ens-item--button">
                                    <button className="btn" type="submit" disabled={status.loading}>
                                        <span className="btn-wrap">
                                            <span className="text-first">{status.loading ? 'Sending...' : 'Send Mail'}</span>
                                        </span>
                                    </button>
                                </div>
                            </div>

                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</section>

    </Layout>
  );
}
