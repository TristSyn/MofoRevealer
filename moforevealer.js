// ==UserScript==
// @name         Mofo Revealer
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Reveal those Black Market mofos
// @author       You
// @match        https://vmapp.pages.dev/
// @match        https://www.vinomofo.com/wines/*
// @match        https://www.vinomofo.com/events/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=vinomofo.com
// @require      https://code.jquery.com/jquery-3.6.4.min.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// ==/UserScript==

(function() {
    'use strict';

    var lookups= {};
    var iframe;
    var isWinePage = false;

    $(startup);

    function startup() {
        var isVMAPP = window.location.href.includes("vmapp");

        if(isVMAPP) {
            if ( window.location !== window.parent.location ) { // only run if is in an iFrame
                console.log('startup VMApp');

                //VMApp iframe waits for messages requesting a wine lookup
                window.addEventListener('message', function(m){
                    var data = m.data;
                    if(data.id && data.anchor) { //sanity check to make sure message is in expected format
                        var url = "https://vm-uncovered-production.up.railway.app/api/vm/offer?offer_id="+data.id;
                        $.get( url, function( get_data ) {
                            NotifyVMPage({result: get_data, request : data });
                        });
                    }
                }, false);
            }
        } else {



            console.log('startup VM Page');
            console.log('adding iframe.');
            prefillFromCache();
            iframe = document.body.appendChild(document.createElement('iframe'));
            iframe.style.display = 'none';
            iframe.src = 'https://vmapp.pages.dev/';


            let previousUrl = '';
            setTimeout(setTitles, 1000);
            const observer = new MutationObserver(function(mutations) {
                if (location.href !== previousUrl) {
                    previousUrl = location.href;
                    setTimeout(setTitles, 1000);
                }
            });
            const config = {subtree: true, childList: true};
            observer.observe(document, config);

            console.log('adding events.');
            window.addEventListener('message', function(m){
                if(m.data && m.data.request) {
                    var data = m.data;
                    if(data.result.originalnames && data.result.originalnames.length > 0)
                        setCache(data.result.offerid, data.result.originalnames[0]);

                    if(isWinePage) {
                        var $h2 = $("h2[class^='Heading__StyledHeading'][class*='OfferHeroCard__StyledHeading']:first");
                        if($h2)
                            setWineTitle($h2, data.result.originalnames[0]);
                    } else {
                        var $anchor = $("a[href='"+data.request.anchor+"']");

                        if($anchor && $anchor.length > 0) {
                            setWineTitle($anchor, data.result.originalnames[0]);
                        }
                    }
                }
            });
        }
    }

    function setTitles() {

        var titleid = $("title").text().split('#')[1];
        if(titleid) {
            titleid = titleid.split(' ')[0];
            if(window.location.href.includes(titleid)) {
                isWinePage = true;
                if(lookups['offerid_'+titleid.trim()]) {
                    var $h2 = $("h2[class^='Heading__StyledHeading'][class*='OfferHeroCard__StyledHeading']:first");
                    if($h2)
                        setWineTitle($h2, lookups['offerid_'+titleid.trim()]);
                } else {
                    //try to get from iframe
                    NotifyVMApp({"id": titleid.trim(), "anchor": '-' })
                }
            }
        } else {
            $("main").on("mouseover", main_mouseover);
            setTitlesFromCache();
        }
    }

    function prefillFromCache() {
        console.log('Load wines from cache');
        var cache = window.localStorage.getItem("lookups");
        if(cache) {
            lookups = JSON.parse(cache);
        } else {
            lookups = {};
            window.localStorage.setItem("lookups", JSON.stringify(lookups));
        }
    }

    function setTitlesFromCache() {
        var $anchors = $("div[class^='Card__StyledCard'] a[class^='OfferCard_']");
        $anchors.each((idx, a) => {
            var idElem = $(a);
            var textid = idElem.text().split('#')[1];
            if(textid)
                textid = textid.split(' ')[0];
            if(textid && idElem.attr('href').includes(textid) && lookups['offerid_'+textid.trim()]) {
                setWineTitle(idElem, lookups['offerid_'+textid.trim()]);
            }
        });
    }

    function main_mouseover() {
        var $div = $("div[class^='Card__StyledCard']:hover");
        if($div && $div.length > 0) {
            var idElem = $div.find('a:first');
            if(!idElem.is("[vm-reveal]")) {
                idElem.attr('vm-reveal', 'request');
                var textid = idElem.text().split('#')[1];
                if(textid)
                    textid = textid.split(' ')[0];
                if(textid && idElem.attr('href').includes(textid)) {
                    NotifyVMApp({"id": textid.trim(), "anchor": idElem.attr('href') });
                }
            }
        }
    }

    function setCache(offerid, originalname) {
        lookups['offerid_'+offerid] = originalname;
        window.localStorage.setItem("lookups", JSON.stringify(lookups));
    }

    function setWineTitle($target, originalname) {
        console.log('set wine title:', originalname);
        $target.attr('vm-reveal', 'done');
        $("<br/><i style='font-size:smaller;'>"+$target.text() + "</i>").insertAfter($target);
        $target.text(originalname);
    }

    function NotifyVMApp(msg) {
        iframe.contentWindow.postMessage(msg, "https://vmapp.pages.dev");
    }

    function NotifyVMPage(msg) {
        window.parent.postMessage(msg, "https://www.vinomofo.com");
    }
})();