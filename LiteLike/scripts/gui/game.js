"use-strict";

import { makeTranslationLookup } from "../io.js";
import { enumerate } from "../utils.js";

export class GameGUI{
    // Generic Translations
    STRINGS = enumerate(
        // None
        "NONE",
        // Equipment Types
        "RESOURCES", "ITEMS", "WEAPONS", "ARMOR", "TRANSPORTS"
    )

    constructor(game){
        this.game = game;
        this.pages = [];
        this.currentpage = null;

        this.translate = makeTranslationLookup(this.game, this.STRINGS, "game");
    }

    get statuspanel(){ return document.getElementById("statuspanel"); }
    get homepanel(){ return document.getElementById("home"); }
    get homenavbar(){ return document.getElementById("homenavbar"); }
    get homecontent(){ return document.getElementById("homecontent"); }
    
    setupUI(){
        document.body.insertAdjacentHTML("beforeend", `<div id="statuspanel"></div><div id="home" style="width:100%;height:75vh;"><div id="homenavbar"></div><hr /><div id="homecontent"></div></div>`);
    }

    /**
     * Creates a Button in Home's navigation bar with displayname as its text. When selected the button will show the page with id `${id}Page`.
     * @param {String} id - The id to apply to the Button
     * @param {String} displayname - The Button's text
     * @returns {Element} - The created button. This can be used to immediately activate the page via setPage
     */
    registerPage(id, displayname){
        // Add to navbar
        this.homenavbar.insertAdjacentHTML("beforeend", `<button id="${id}">${displayname}</button>`);
        let button = this.homenavbar.lastElementChild;
        // Hookup button to show page
        button.onclick = ()=>this.setPage(button);
        // Make sure page is hidden
        this.homecontent.querySelector(`#${id}Page`).style.height = "0px";
        return button;
    }
    /**
     * Callback for Home Page Buttons: swaps the currently displayed page to the selected one.
     * Register Page is used to setup this callback
     * Adapted from colonydemo
     * 
     * @param {Element} button - The button pressed
     */
    setPage(button){
        this.currentpage = button.id;
        let pageid = button.id+"Page";
        // Reenable all buttons
        for(let button of this.homenavbar.children) button.disabled = false;
        // Hide all pages
        for(let div of this.homecontent.children) div.style.height = "0px";
        // Disable Button
        button.disabled = true;
        // Show correct page
        document.getElementById(pageid).style.height = "100%";
    }

}