import React from 'react';
import Layout from '../components/layout/Layout';
import { loadSiteContentConfig } from '../utils/siteContentConfig';

export default function ContactUsPage() {
  const config = loadSiteContentConfig();

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
                    <div className="ens-form--inner">
                        <div className="row">
                            <div className="col-lg-6 col-md-6 mb-4">
                                <div className="form-group">
                                    <input type="text" name="name" className="form-control" placeholder="Name*" required />
                                </div>
                            </div>

                            <div className="col-lg-6 col-md-6 mb-4">
                                <div className="form-group">
                                    <input type="email" name="email" className="form-control" placeholder="E-mail*" required />
                                </div>
                            </div>

                            <div className="col-lg-12 col-md-12 mb-4">
                                <div className="form-group">
                                    <input type="text" name="subject" className="form-control" placeholder="Subject" />
                                </div>
                            </div>

                            <div className="col-md-12 col-lg-12 mb-4">
                                <div className="form-group">
                                    <textarea name="message" className="form-control" placeholder="Text"></textarea>
                                </div>
                            </div>

                            <div className="col-md-12 col-lg-12">
                                <div className="ens-item--button">
                                    <button className="btn" type="button" id="sendEmailContactUs">
                                        <span className="btn-wrap">
                                            <span className="text-first">Send Mail</span>
                                        </span>
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

    </Layout>
  );
}
