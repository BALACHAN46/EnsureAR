import React from 'react';
import Layout from '../components/layout/Layout';
import { loadSiteContentConfig } from '../utils/siteContentConfig';

export default function LandingPage() {
  const config = loadSiteContentConfig();

  return (
    <Layout>

{/*  Slider Section  */}
<section className="ens-slider style2" style={{position:'relative', overflow:'hidden'}}>
    <div className="swiper-container ens-swiper-slider-two">
        {/*  swiper slides  */}
        <div className="swiper-wrapper">
            {/*  Slide Item  */}
            <div className="swiper-slide">
                <div className="ens-slider--item">
                    <div className="mobile-img"><img src="/img/slider/mobile01.png" /></div>
                    <div className="ens-slider--image" style={{ backgroundImage: `url('/img/slider/1.jpg')` }}></div>
                    <div className="ens-slider--inner">
                        <div className="ens-heading">
                            <div className="ens-item--inner">
                                <h1 className="ens-item--title">Virtual Try-On</h1>
                                <h6 className="ens-item--subtitle">Try before you buy — virtually</h6>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/*  End Slide Item  */}
            {/*  Slide Item  */}
            <div className="swiper-slide">
                <div className="ens-slider--item">
                    <div className="ipad-img"><img src="/img/slider/ipad02.png" /></div>
                    <div className="ens-slider--image" style={{ backgroundImage: `url('/img/slider/2.jpg')` }}></div>
                    <div className="ens-slider--inner">
                        <div className="ens-heading">
                            <div className="ens-item--inner">
                                <h1 className="ens-item--title">Smart Try-On</h1>
                                <h6 className="ens-item--subtitle">Style meets technology</h6>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/*  End Slide Item  */}
            {/*  Slide Item  */}
            <div className="swiper-slide">
                <div className="ens-slider--item">
                    <div className="laptop-img"><img src="/img/slider/laptop01.png" /></div>
                    <div className="ens-slider--image" style={{ backgroundImage: `url('/img/slider/3.jpg')` }}></div>
                    <div className="ens-slider--inner">
                        <div className="ens-heading">
                            <div className="ens-item--inner">
                                <h1 className="ens-item--title">AR Try-On</h1>
                                <h6 className="ens-item--subtitle">No fitting room needed</h6>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/*  End Slide Item  */}
            {/*  Slide Item  */}
            <div className="swiper-slide">
                <div className="ens-slider--item">
                    <div className="ipad-img"><img src="/img/slider/Ipad04.png" /></div>
                    <div className="ens-slider--image" style={{ backgroundImage: `url('/img/slider/5.jpg')` }}></div>
                    <div className="ens-slider--inner">
                        <div className="ens-heading">
                            <div className="ens-item--inner">
                                <h1 className="ens-item--title">Virtual Styling</h1>
                                <h6 className="ens-item--subtitle">Virtual try, real vibes</h6>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/*  End Slide Item  */}
            {/*  Slide Item  */}
            <div className="swiper-slide">
                <div className="ens-slider--item">
                    <div className="laptop-img"><img src="/img/slider/laptop02.png" /></div>
                    <div className="ens-slider--image" style={{ backgroundImage: `url('/img/slider/6.jpg')` }}></div>
                    <div className="ens-slider--inner">
                        <div className="ens-heading">
                            <div className="ens-item--inner">
                                <h1 className="ens-item--title">Digital Try-On</h1>
                                <h6 className="ens-item--subtitle">Try it on your wrist — instantly</h6>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/*  End Slide Item  */}
        </div>
    </div>

    {/*  Left Pane - AUGMENTED REALITY vertical text  */}
    <div style={{
        position:'absolute', top:0, bottom:0, left:0,
        width:'100px', zIndex:11,
        padding:'70px 0px 100px 0px',
        display:'flex', flexDirection:'column',
        justifyContent:'center', alignItems:'center'
    }}>
        <span style={{
            transform:'rotate(-90deg)',
            transformOrigin:'center center',
            whiteSpace:'nowrap',
            fontSize:'13px',
            fontWeight:'600',
            letterSpacing:'4px',
            textTransform:'uppercase',
            color:'rgba(255,255,255,1)',
            opacity:0.5,
            fontFamily:'var(--font-family-three, inherit)'
        }}>
            Augmented Reality
        </span>
    </div>

    <div style={{position:'absolute', top:0, bottom:0, right:0, width:'80px', zIndex:20, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', pointerEvents:'all'}}>
        <ul style={{listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:'20px', alignItems:'center'}}>
            <li>
                <a href={config.socialMedia.facebook} target="_blank" rel="noreferrer"
                   style={{display:'flex', alignItems:'center', justifyContent:'center', width:'34px', height:'34px', borderRadius:'50%', border:'1px solid rgba(255,255,255,0.6)', color:'#fff', textDecoration:'none', fontSize:'15px', transition:'all 0.3s'}}>
                    <i className="bi bi-facebook"></i>
                </a>
            </li>
            <li>
                <a href={config.socialMedia.instagram} target="_blank" rel="noreferrer"
                   style={{display:'flex', alignItems:'center', justifyContent:'center', width:'34px', height:'34px', borderRadius:'50%', border:'1px solid rgba(255,255,255,0.6)', color:'#fff', textDecoration:'none', fontSize:'15px', transition:'all 0.3s'}}>
                    <i className="bi bi-instagram"></i>
                </a>
            </li>
            <li>
                <a href={config.socialMedia.linkedin} target="_blank" rel="noreferrer"
                   style={{display:'flex', alignItems:'center', justifyContent:'center', width:'34px', height:'34px', borderRadius:'50%', border:'1px solid rgba(255,255,255,0.6)', color:'#fff', textDecoration:'none', fontSize:'15px', transition:'all 0.3s'}}>
                    <i className="bi bi-linkedin"></i>
                </a>
            </li>
        </ul>
    </div>

    {/*  Bottom Pane - PREV ... dots ... NEXT  */}
    <div className="ens-bottom-pane justify-content-center">
        {/*  pagination dots  */}
        <div className="ens-swiper-dots style2">
            <div className="swiper-pagination"></div>
        </div>

        {/*  Swiper Navigation  */}
        <div className="ens-swiper-navigation style3">
            <div className="ens-swiper-arrow swiper-button-prev"></div>
            <div className="ens-swiper-arrow swiper-button-next"></div>
        </div>
    </div>

</section>



{/*  About ENSUREAR  */}
<section className="ens-about-two">
    <div className="container">
        {/*  Services  */}
        <div className="pd-bottom-100">
            <div className="row">
                {/*  Iconbox  */}
                <div className="col-md-4 wow fadeInLeft">
                    <div className="ens-icon-box6 mb-md-0 active highlight">
                        <div className="ens-item--inner">
                            <div className="ens-item--icon">
                                <a href="#">
                                    <img src="/img/01.png" alt="Jewellery" />
                                </a>
                            </div>
                            <div className="ens-item--holder">
                                <h4 className="ens-item--title"><a href="#">Jewellery Try-On</a></h4>
                                <p className="ens-item--description">Experience the sparkle before you buy! Our Jewellery Virtual Try-On lets you preview necklaces, sets, earrings, rings, and nosepins on yourself in real-time — helping you find the perfect match without stepping into a store.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/*  Iconbox  */}
                <div className="col-md-4 wow fadeInLeft">
                    <div className="ens-icon-box6 mb-md-0">
                        <div className="ens-item--inner">
                            <div className="ens-item--icon">
                                <a href="#">
                                    <img src="/img/03.png" alt="Eyewear" />
                                </a>
                            </div>
                            <div className="ens-item--holder">
                                <h4 className="ens-item--title"><a href="#">Eyewear Try-On</a></h4>
                                <p className="ens-item--description">Redefine the way you shop for eyewear. Our Virtual Try-On experience lets you explore timeless designs and premium frames on your face — bringing elegance and confidence to every choice.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/*  Iconbox  */}
                <div className="col-md-4 wow fadeInLeft">
                    <div className="ens-icon-box6 mb-md-0">
                        <div className="ens-item--inner">
                            <div className="ens-item--icon">
                                <a href="#">
                                    <img src="/img/02.png" alt="Watches" />
                                </a>
                            </div>
                            <div className="ens-item--holder">
                                <h4 className="ens-item--title"><a href="#">Watches Try-On</a></h4>
                                <p className="ens-item--description">Time meets technology. Experience the elegance of premium watches with our Virtual Try-On, allowing you to visualize every detail on your wrist before making a timeless choice.</p>
                            </div>
                        </div>
                    </div>
                </div>


            </div>
        </div>


        <div className="row">
            <div className="col-md-6">
                <div className="ens-image-single wow fadeInUp">
                    <div className="ens-item--inner">
                        <div className="ens-item--image position-relative">
                            <img src="/img/04.png" alt="img" />

                            <div className="ens-item--button about-btn">
                                <a href="#" className="btn btn-two creative text-uppercase">
                                    <span className="btn-wrap">
                                        <span className="text-first">Try-On Now</span>
                                        <span className="text-second"><i className="bi bi-arrow-up-right"></i> <i className="bi bi-arrow-up-right"></i></span>
                                    </span>
                                </a>
                            </div>

                        </div>
                    </div>

                    <div className="ens-item-layer ens-item-layer-one both-version">
                        <img src="/img/more/light-2.png" alt="img" />
                        <img src="/img/more/light-2-light.png" alt="img" />
                    </div>
                </div>
            </div>

            <div className="col-md-6 ps-md-5 mt-4 mt-md-0">
                <div className="ens-about--text ps-md-5">
                    <h3>{config.aboutEnsureAR.title}</h3>
                    <p className="ens-about--text-one">{config.aboutEnsureAR.landingSubtitle}</p>
                    <p>{config.aboutEnsureAR.text1}</p>
                    <p>{config.aboutEnsureAR.text2}</p>
                </div>
            </div>
        </div>
    </div>

    <div className="ens-item-layer ens-item-layer-two">
        <img src="/img/more/texture-5.png" alt="img" />
    </div>
    <div className="ens-item-layer ens-item-layer-three">
        <img src="/img/more/texture-4.png" alt="img" />
    </div>
</section>




{/*  Contact  */}
<section className="ens-contact-form style1">
    <div className="ens-item-layer both-version">
        <img src="/img/more/texture-2.png" alt="" />
        <img src="/img/more/texture-2-light.png" alt="" />
    </div>
    <div className="container">
        <div className="ens-form--wrapper">
            <div className="ens-heading">
                <div className="ens-item--inner text-center">
                    <h1 className="ens-item--title"> Get In Touch</h1>
                    <div className="ens-item--description"> Try it before you buy it! Contact us for a fun Virtual Try-On experience. </div>
                </div>
            </div>

            <div className="row">
                <div className="col-lg-8 offset-lg-2">
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
                                <div className="ens-item--button text-center">
                                    <button className="btn white-opacity creative text-uppercase" type="button" id="sendEmailContactUs">
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

        <div className="ens-office-address mr-top-100">
            <div className="row">

                <div className="col-lg-6 col-md-4">
                    <div className="ens-icon-box1 wow fadeInLeft">
                        <div className="ens-item--inner flex-start">
                            <div className="ens-item--icon"><i className="bi bi-geo-alt"></i></div>
                            <div className="ens-item--holder">
                                <h5 className="ens-item--title">Ensurear</h5>
                                <p className="ens-item--description">
                                    {config.contact.address}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-3 col-md-4">
                    <div className="ens-icon-box1 wow fadeInLeft">
                        <div className="ens-item--inner flex-start">
                            <div className="ens-item--icon"><i className="bi bi-globe"></i></div>
                            <div className="ens-item--holder">
                                <h5 className="ens-item--title">Email ID</h5>
                                <p className="ens-item--description">{config.contact.email}</p>
                                <a href={`mailto:${config.contact.email}`} className="ens-item--link">Email Now</a>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-3 col-md-4">
                    <div className="ens-icon-box1 wow fadeInLeft">
                        <div className="ens-item--inner flex-start">
                            <div className="ens-item--icon"><i className="bi bi-phone"></i></div>
                            <div className="ens-item--holder">
                                <h5 className="ens-item--title">Contact Us</h5>
                                <p className="ens-item--description">{config.contact.phone}</p>
                                <a href={`tel:${config.contact.phone.replace(/[^0-9+]/g, '')}`} className="ens-item--link">Call Now</a>
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
