import React, { useState, useEffect } from 'react';
import { loadSiteContentConfig, DEFAULT_CONFIG } from '../../utils/siteContentConfig';
import { getAllProducts } from '../../services/productsApi';
import { getMenu } from '../../services/categoriesApi';

export default function Navbar() {
    const [catalog, setCatalog] = useState([]);
    const [menu, setMenu] = useState([]);
    const [config, setConfig] = useState(DEFAULT_CONFIG);

    useEffect(() => { loadSiteContentConfig().then(setConfig); }, []);
    useEffect(() => { getAllProducts().then(setCatalog).catch(() => {}); }, []);
    useEffect(() => { getMenu().then(setMenu).catch(() => {}); }, []);

    const getFirstModel = (cat) => {
        const found = catalog.find(m => m.category === cat);
        return found ? `/ar/${cat}/${found.id}` : '#';
    };

    return (
        <>
            <header className="header color-fixed">
                <div className="header-inner">
                    <div className="container-fluid pe-0">
                        <div className="d-flex align-items-center justify-content-between">
                            {/* Left Part */}
                            <div className="header_left_part d-flex align-items-center">
                                <div className="logo">
                                    <a href="/" className="light_logo"><img src="/img/EnsureAR.png" alt="logo" /></a>
                                    <a href="/" className="dark_logo"><img src="/img/EnsureAR_dark.png" alt="logo" /></a>
                                </div>
                            </div>

                            {/* Center Part */}
                            <div className="header_center_part d-none d-xl-block">
                                <div className="mainnav">
                                    <ul className="main-menu">
                                        <li className="menu-item"><a href="/">Home</a></li>
                                        <li className="menu-item"><a href="/about">About Us</a></li>
                                        <li className="menu-item menu-item-has-children">
                                            <a href="#">Virtual Try-On</a>
                                            <ul className="sub-menu" data-lenis-prevent="true">
                                                {menu.map((parent) => {
                                                    const hasSubmenu = parent.children?.length > 1;
                                                    const directSlug = parent.children?.[0]?.slug;
                                                    return (
                                                        <li key={parent.parentCategoryId} className={hasSubmenu ? "menu-item menu-item-has-children" : "menu-item"}>
                                                            <a href={hasSubmenu ? "#" : getFirstModel(directSlug)}>{parent.name}</a>
                                                            {hasSubmenu && (
                                                                <ul className="sub-menu" data-lenis-prevent="true">
                                                                    {parent.children.map((child) => (
                                                                        <li key={child.childCategoryId} className="menu-item">
                                                                            <a href={getFirstModel(child.slug)}>{child.name}</a>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </li>
                                        <li className="menu-item"><a href="/contact">Contact Us</a></li>
                                    </ul>
                                </div>
                            </div>

                            {/* Right Part */}
                            <div className="header_right_part d-flex align-items-center">
                                <div className="aside_open ens-element">
                                    <div className="aside-open--inner">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>

                                <div className="header_search ens-element">
                                    <a href={getFirstModel('necklace')}><img src="/img/try-on.png" alt="img" /></a>
                                </div>

                                <button type="button" className="mr_menu_toggle ens-element d-xl-none">
                                    <i className="bi bi-list"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Responsive Menu */}
            <div className="mr_menu" data-lenis-prevent="true">
                <button type="button" className="mr_menu_close"><i className="bi bi-x-lg"></i></button>
                <div className="logo">
                    <a href="/" className="light_logo"><img src="/img/EnsureAR.png" alt="logo" /></a>
                    <a href="/" className="dark_logo"><img src="/img/EnsureAR_dark.png" alt="logo" /></a>
                </div>
                <h6>Menu</h6>
                <div className="mr_navmenu">
                    <ul className="main-menu">
                        <li className="menu-item"><a href="/">Home</a></li>
                        <li className="menu-item"><a href="/about">About Us</a></li>
                        <li className="menu-item menu-item-has-children">
                            <a href="#">Virtual Try-On</a>
                            <ul className="sub-menu" data-lenis-prevent="true" style={{ display: 'none' }}>
                                {menu.map((parent) => {
                                    const hasSubmenu = parent.children?.length > 1;
                                    const directSlug = parent.children?.[0]?.slug;
                                    return (
                                        <li key={parent.parentCategoryId} className={hasSubmenu ? "menu-item menu-item-has-children" : "menu-item"}>
                                            <a href={hasSubmenu ? "#" : getFirstModel(directSlug)}>{parent.name}</a>
                                            {hasSubmenu && (
                                                <ul className="sub-menu" data-lenis-prevent="true" style={{ display: 'none' }}>
                                                    {parent.children.map((child) => (
                                                        <li key={child.childCategoryId} className="menu-item">
                                                            <a href={getFirstModel(child.slug)}>{child.name}</a>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            {hasSubmenu && (
                                                <span 
                                                    className="submenu_opener" 
                                                    onClick={(e) => {
                                                        const parentLi = e.currentTarget.parentElement;
                                                        parentLi.classList.toggle('nav_open');
                                                        const subMenu = parentLi.querySelector('.sub-menu');
                                                        if (subMenu) {
                                                            subMenu.style.display = subMenu.style.display === 'block' ? 'none' : 'block';
                                                        }
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                    }}
                                                >
                                                    <i className="bi bi-chevron-right"></i>
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                            <span 
                                className="submenu_opener" 
                                onClick={(e) => {
                                    const parentLi = e.currentTarget.parentElement;
                                    parentLi.classList.toggle('nav_open');
                                    const subMenu = parentLi.querySelector('.sub-menu');
                                    if (subMenu) {
                                        subMenu.style.display = subMenu.style.display === 'block' ? 'none' : 'block';
                                    }
                                    e.stopPropagation();
                                    e.preventDefault();
                                }}
                            >
                                <i className="bi bi-chevron-right"></i>
                            </span>
                        </li>
                        <li className="menu-item"><a href="/contact">Contact Us</a></li>
                    </ul>
                </div>
            </div>

            <div className="aside_info_wrapper" data-lenis-prevent="true">
                <button className="aside_close">Close <i className="bi bi-x-lg"></i></button>

                <div className="aside_logo logo">
                    <a href="/" className="light_logo"><img src="/img/EnsureAR.png" alt="logo" /></a>
                    <a href="/" className="dark_logo"><img src="/img/EnsureAR_dark.png" alt="logo" /></a>
                </div>

                <div className="aside_info_inner">
                    <div className="ens-icon-box1 style2">
                        <div className="ens-item--inner flex-start">
                            <div className="ens-item--icon"><i className="bi bi-envelope"></i></div>
                            <div className="ens-item--holder">
                                <p className="ens-item--description"><a href={`mailto:${config.contact.email}`}>{config.contact.email}</a></p>
                            </div>
                        </div>
                    </div>

                    <div className="ens-icon-box1 style2">
                        <div className="ens-item--inner flex-start">
                            <div className="ens-item--icon"><i className="bi bi-geo-alt"></i></div>
                            <div className="ens-item--holder">
                                <p className="ens-item--description"><a href="#">{config.contact.address}</a></p>
                            </div>
                        </div>
                    </div>

                    <div className="ens-icon-box1 style2">
                        <div className="ens-item--inner flex-start">
                            <div className="ens-item--icon"><i className="bi bi-envelope"></i></div>
                            <div className="ens-item--holder">
                                <p className="ens-item--description"><a href={`tel:${config.contact.phone.replace(/[^0-9+]/g, '')}`}>{config.contact.phone}</a></p>
                            </div>
                        </div>
                    </div>

                    <h6>Follow Us</h6>
                    <div className="social-box style-square">
                        <ul>
                            <li><a href={config.socialMedia.facebook} target="_blank" rel="noopener noreferrer"><i className="bi bi-facebook"></i></a></li>
                            <li><a href={config.socialMedia.instagram} target="_blank" rel="noopener noreferrer"><i className="bi bi-instagram"></i></a></li>
                            <li><a href={config.socialMedia.linkedin} target="_blank" rel="noopener noreferrer"><i className="bi bi-linkedin"></i></a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </>
    );
}
