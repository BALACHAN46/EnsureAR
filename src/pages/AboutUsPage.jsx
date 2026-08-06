import React, { useState } from 'react';
import Layout from '../components/layout/Layout';
import { loadSiteContentConfig } from '../utils/siteContentConfig';

export default function AboutUsPage() {
  const [activeAccordion, setActiveAccordion] = useState(0);
  const config = loadSiteContentConfig();

  const toggleAccordion = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeAccordion === index) {
      setActiveAccordion(null);
    } else {
      setActiveAccordion(index);
    }
  };

  return (
    <Layout>
      


<section className="section-padding ens-faq-one bg-image pb-0" style={{ backgroundImage: `url('/img/background/bg-8.jpg')` }}>
    <div className="container">

        <div className="row">
            <div className="col-lg-7">
                <div className="ens-heading">
                    <div className="ens-item--inner">
                        <h1 className="ens-item--title mb-lg-0">{config.aboutEnsureAR.title}</h1>
                        <p>{config.aboutEnsureAR.text1}</p>
                        <p>{config.aboutEnsureAR.text2}</p>
                    </div>
                </div>

                <div className="ens-accordion ens-accordion2 wow fadeInUp">
                    <div className={`ens--item ${activeAccordion === 0 ? 'active' : ''}`}>
                        <h6 className="ens-item-title" onClick={(e) => toggleAccordion(0, e)} style={{ cursor: 'pointer' }}><span>Vision</span> <i className="plus bi bi-plus"></i> <i className="minus bi bi-dash"></i></h6>
                        <div className="ens-item--content" style={{ display: activeAccordion === 0 ? 'block' : 'none' }}>
                            {config.vision}
                        </div>
                    </div>

                    <div className={`ens--item ${activeAccordion === 1 ? 'active' : ''}`}>
                        <h6 className="ens-item-title" onClick={(e) => toggleAccordion(1, e)} style={{ cursor: 'pointer' }}><span>Mission</span> <i className="plus bi bi-plus"></i> <i className="minus bi bi-dash"></i></h6>
                        <div className="ens-item--content" style={{ display: activeAccordion === 1 ? 'block' : 'none' }}>
                            {config.mission}
                        </div>
                    </div>

                    <div className={`ens--item ${activeAccordion === 2 ? 'active' : ''}`}>
                        <h6 className="ens-item-title" onClick={(e) => toggleAccordion(2, e)} style={{ cursor: 'pointer' }}><span>Why Choose Us</span> <i className="plus bi bi-plus"></i> <i className="minus bi bi-dash"></i></h6>
                        <div className="ens-item--content" style={{ display: activeAccordion === 2 ? 'block' : 'none' }}>
                            <div dangerouslySetInnerHTML={{ __html: config.whyChooseUs }} />

                            Future-Ready Innovation - Constantly evolving with the latest in AR and digital commerce trends.
                        </div>
                    </div>
                </div>


            </div>

            <div className="col-lg-5">
                <div className="ens-image-single wow fadeInUp">
                    <div className="ens-item--inner">
                        <div className="ens-item--image">
                            <img src="/img/slider/Ipad02.png" alt="img" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

{/*  Testimonial  */}
<section className="section-padding ens-testimonial-one testimonial-colored bg-image" style={{ backgroundImage: `url('/img/background/bg-2.jpg')` }}>
    <div className="container">
        <div className="row">
            <div className="col-lg-7">
                <div className="swiper-container swiper-testimonial">
                    {/*  swiper slides  */}
                    <div className="swiper-wrapper">
                        <div className="swiper-slide">
                            <div className="ens-testimonial1">
                                <div className="ens-item--inner">
                                    <div className="ens-item--holder">
                                        <div className="d-flex align-items-center justify-content-between mr-bottom-25">
                                            <div className="ens-item--meta-rating">
                                                <i className="bi bi-star-fill"></i>
                                                <i className="bi bi-star-fill"></i>
                                                <i className="bi bi-star-fill"></i>
                                                <i className="bi bi-star-fill"></i>
                                                <i className="bi bi-star-fill"></i>
                                            </div>

                                            <div className="ens-item--icon">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="57" height="45" viewBox="0 0 57 45" fill="none">
                                                    <path d="M51.5137 38.5537C56.8209 32.7938 56.2866 25.3969 56.2697 25.3125V2.8125C56.2697 2.06658 55.9734 1.35121 55.4459 0.823763C54.9185 0.296317 54.2031 0 53.4572 0H36.5822C33.48 0 30.9572 2.52281 30.9572 5.625V25.3125C30.9572 26.0584 31.2535 26.7738 31.781 27.3012C32.3084 27.8287 33.0238 28.125 33.7697 28.125H42.4266C42.3671 29.5155 41.9517 30.8674 41.22 32.0513C39.7913 34.3041 37.0997 35.8425 33.2156 36.6188L30.9572 37.0688V45H33.7697C41.5969 45 47.5678 42.8316 51.5137 38.5537ZM20.5566 38.5537C25.8666 32.7938 25.3294 25.3969 25.3125 25.3125V2.8125C25.3125 2.06658 25.0162 1.35121 24.4887 0.823763C23.9613 0.296317 23.2459 0 22.5 0H5.625C2.52281 0 0 2.52281 0 5.625V25.3125C0 26.0584 0.296316 26.7738 0.823762 27.3012C1.35121 27.8287 2.06658 28.125 2.8125 28.125H11.4694C11.41 29.5155 10.9945 30.8674 10.2628 32.0513C8.83406 34.3041 6.1425 35.8425 2.25844 36.6188L0 37.0688V45H2.8125C10.6397 45 16.6106 42.8316 20.5566 38.5537Z" fill="#D70006" />
                                                </svg>
                                            </div>
                                        </div>

                                        <p className="ens-item--description">
                                            {config.testimonial.text}
                                        </p>
                                        <div className="ens-item--meta">
                                            {/* <div className="ens-item--image">
                                                <img src="/img/testimonial/1.jpg" alt="img" />
                                            </div> */}
                                            <div className="ens-item--meta-left">
                                                <h4 className="ens-item--title">{config.testimonial.name}</h4>
                                                <h6 className="ens-item--designation">{config.testimonial.location}</h6>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="swiper-slide">
                            <div className="ens-testimonial1">
                                <div className="ens-item--inner">
                                    <div className="ens-item--holder">
                                        <div className="d-flex align-items-center justify-content-between mr-bottom-25">
                                            <div className="ens-item--meta-rating">
                                                <i className="bi bi-star-fill"></i>
                                                <i className="bi bi-star-fill"></i>
                                                <i className="bi bi-star-fill"></i>
                                                <i className="bi bi-star-fill"></i>
                                                <i className="bi bi-star-fill"></i>
                                            </div>

                                            <div className="ens-item--icon">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="57" height="45" viewBox="0 0 57 45" fill="none">
                                                    <path d="M51.5137 38.5537C56.8209 32.7938 56.2866 25.3969 56.2697 25.3125V2.8125C56.2697 2.06658 55.9734 1.35121 55.4459 0.823763C54.9185 0.296317 54.2031 0 53.4572 0H36.5822C33.48 0 30.9572 2.52281 30.9572 5.625V25.3125C30.9572 26.0584 31.2535 26.7738 31.781 27.3012C32.3084 27.8287 33.0238 28.125 33.7697 28.125H42.4266C42.3671 29.5155 41.9517 30.8674 41.22 32.0513C39.7913 34.3041 37.0997 35.8425 33.2156 36.6188L30.9572 37.0688V45H33.7697C41.5969 45 47.5678 42.8316 51.5137 38.5537ZM20.5566 38.5537C25.8666 32.7938 25.3294 25.3969 25.3125 25.3125V2.8125C25.3125 2.06658 25.0162 1.35121 24.4887 0.823763C23.9613 0.296317 23.2459 0 22.5 0H5.625C2.52281 0 0 2.52281 0 5.625V25.3125C0 26.0584 0.296316 26.7738 0.823762 27.3012C1.35121 27.8287 2.06658 28.125 2.8125 28.125H11.4694C11.41 29.5155 10.9945 30.8674 10.2628 32.0513C8.83406 34.3041 6.1425 35.8425 2.25844 36.6188L0 37.0688V45H2.8125C10.6397 45 16.6106 42.8316 20.5566 38.5537Z" fill="#D70006" />
                                                </svg>
                                            </div>
                                        </div>

                                        <p className="ens-item--description">
                                            "Trying jewellery virtually before buying gave me complete confidence. The AR experience felt so real that I could see how it looked on me without stepping into the store."
                                        </p>
                                        <div className="ens-item--meta">
                                            {/* <div className="ens-item--image">
                                                <img src="/img/testimonial/2.jpg" alt="img" />
                                            </div> */}
                                            <div className="ens-item--meta-left">
                                                <h4 className="ens-item--title">Jordan</h4>
                                                <h6 className="ens-item--designation">New York</h6>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="swiper-slide">
                            <div className="ens-testimonial1">
                                <div className="ens-item--inner">
                                    <div className="ens-item--holder">
                                        <div className="d-flex align-items-center justify-content-between mr-bottom-25">
                                            <div className="ens-item--meta-rating">
                                                <i className="bi bi-star-fill"></i>
                                                <i className="bi bi-star-fill"></i>
                                                <i className="bi bi-star-fill"></i>
                                                <i className="bi bi-star-fill"></i>
                                                <i className="bi bi-star-fill"></i>
                                            </div>

                                            <div className="ens-item--icon">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="57" height="45" viewBox="0 0 57 45" fill="none">
                                                    <path d="M51.5137 38.5537C56.8209 32.7938 56.2866 25.3969 56.2697 25.3125V2.8125C56.2697 2.06658 55.9734 1.35121 55.4459 0.823763C54.9185 0.296317 54.2031 0 53.4572 0H36.5822C33.48 0 30.9572 2.52281 30.9572 5.625V25.3125C30.9572 26.0584 31.2535 26.7738 31.781 27.3012C32.3084 27.8287 33.0238 28.125 33.7697 28.125H42.4266C42.3671 29.5155 41.9517 30.8674 41.22 32.0513C39.7913 34.3041 37.0997 35.8425 33.2156 36.6188L30.9572 37.0688V45H33.7697C41.5969 45 47.5678 42.8316 51.5137 38.5537ZM20.5566 38.5537C25.8666 32.7938 25.3294 25.3969 25.3125 25.3125V2.8125C25.3125 2.06658 25.0162 1.35121 24.4887 0.823763C23.9613 0.296317 23.2459 0 22.5 0H5.625C2.52281 0 0 2.52281 0 5.625V25.3125C0 26.0584 0.296316 26.7738 0.823762 27.3012C1.35121 27.8287 2.06658 28.125 2.8125 28.125H11.4694C11.41 29.5155 10.9945 30.8674 10.2628 32.0513C8.83406 34.3041 6.1425 35.8425 2.25844 36.6188L0 37.0688V45H2.8125C10.6397 45 16.6106 42.8316 20.5566 38.5537Z" fill="#D70006" />
                                                </svg>
                                            </div>
                                        </div>

                                        <p className="ens-item--description">
                                            "Trying jewellery virtually before buying gave me complete confidence. The AR experience felt so real that I could see how it looked on me without stepping into the store."
                                        </p>
                                        <div className="ens-item--meta">
                                            {/* <div className="ens-item--image">
                                                <img src="/img/testimonial/3.jpg" alt="img" />
                                            </div> */}
                                            <div className="ens-item--meta-left">
                                                <h4 className="ens-item--title">Helen</h4>
                                                <h6 className="ens-item--designation">New York</h6>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/*  Swiper Navigation  */}
                    <div className="ens-swiper-navigation style1">
                        <div className="ens-swiper-arrow swiper-button-prev"></div>
                        <div className="ens-swiper-arrow swiper-button-next"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>
    </Layout>
  );
}
