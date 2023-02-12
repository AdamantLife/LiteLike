"use-strict";
import { enumerate } from "./utils.js";
import {makeTranslationLookup} from "./io.js";
import * as SITEGUI from "./gui/site.js";

/**
 * The Object responsible for monitoring Events propagated by GAME elements
 * and determining whether or not to log them to the UI Message Box for the
 * Player to see.
 * 
 * DEVNOTE- While many parts of this codebase separate the backend logic from
 *  the frontend display, MessageLog is heavily intertwined with both and
 *  therefore has not been split into two separate files (i.e.-
 *  "scripts/messagelog.js" and "scripts/gui/messagelog.js")
 */

const NOTIFICATIONS = enumerate("POWER", "MEEPLE", "COMBAT");

const STRINGS = enumerate(
    // Status Panel
    "SYSTEMLOG",
    "ADDBATTERIES",
    "POWERLEVEL0","POWERLEVEL1","POWERLEVEL2","POWERLEVEL3","POWERLEVEL4","POWERLEVEL5",
)

export class MessageLog{
    constructor(game){
        this.game = game

        this.translate = makeTranslationLookup(this.game, STRINGS, "messagelog");

        /** Colony Update Messages */
        // Add message for powerlevel changes
        this.game.COLONY.addEventListener("powerlevelmodified", this.powerUpdate.bind(this));
        // Meeple Added/Dead
        this.game.COLONY.addEventListener("meeplemodified", this.meepleUpdate.bind(this));
        // When new encounters occur we need to know what to listen for
        this.game.addEventListener("encounterinitialized", this.bindEncounter.bind(this));
    }

    /**
     * Adds the #messagebox to the UI
     */
    setupUI(){
        // In case the Home Page hasn't populated yet
        let statpanel = this.game.COLONY.ui.statuspanel;
        // Setup UI
        statpanel.insertAdjacentHTML("afterbegin", `<div id="messagebox" class="statusbox"><div class="header">${this.translate(STRINGS.SYSTEMLOG)}<button class="resize" style="margin-left: auto; margin-right:0px;"></button></div><div class="body tall"><ul></ul><div class="fadeoutmask"></div></div></div>`);
        // Setup messagebox hide/show
        SITEGUI.attachPanelResizeCallback(document.getElementById("messagebox"));
    }

    /**
     * Checks what type of Encounter has been initialized and creates any additional
     * bindings as necessary
     * @param {GameEvent} event - An encounterinitialized event
     */
    bindEncounter(event){

    }

    /**
     * Formats and adds the given String to #messageboxbody
     * @param {String} message - Adds the given message to the GUI
     * @param {Symbol} [notification] - What notification color (if any) to flash
     */
    addMessage(message, notification = null){
        // Add message line to messageboxbody
        document.querySelector("#messagebox>.body>ul").insertAdjacentHTML('afterbegin', `<li>${message}</li>`);
        // No notifcation flash
        if(!notification) return;

        // Deterimine flash color
        let backgroundColor;
        // DEVNOTE- We're probably never going to call addMessage from outside the MessageLog class
        //      so we should always have access to NOTIFICATIONS and therefore don't need to parse
        //      notification from string
        switch(notification){
            case NOTIFICATIONS.POWER:
                backgroundColor = "gold";
                break;
            case NOTIFICATIONS.MEEPLE:
                backgroundColor = "lawngreen";
                break;
            case NOTIFICATIONS.COMBAT:
                backgroundColor = "red";
                break;
        }
        // Invalid notification
        if(!backgroundColor) return;

        // Flash the line item
        SITEGUI.flashText(document.querySelector("#messagebox>.body li:first-of-type"), {color: "white", backgroundColor, duration: 1000, iterations: 1});
        // Flash the header too in case the messagebox is collapsed
        SITEGUI.flashText(document.querySelector("#messagebox>.header"), {color: "white", backgroundColor, duration:1000, iterations: 1});
    }

    /**
     * UPDATE CALLBACKS
     */

    /**
     * Adds a message to the log regarding changes to The Colony's Power Level
     * @param {TheColonyEvent} event - TheColony's powerlevelmodified event
     */
    powerUpdate(event){
        // We have two possible messages: one for adding batteries
        // and the other for the brightness level of TheColony

        // event.change > 0 means we added batteries
        if(event.change && typeof event.change !== "undefined" && event.change > 0){
            this.addMessage(this.translate(STRINGS.ADDBATTERIES), NOTIFICATIONS.POWER);
        }

        // If power is increasing, then we only notify on odd numbers
        // powerlevel%2 is 0 for even numbers, so !0 == True
        if(event.change > 0 && !(event.powerlevel % 2)) return;
        // If the power is decreasing, then we only notify on even numbers
        if(event.change < 0 && event.powerlevel % 2) return;

        // We'll use TheColony's UI to get the population description
        // We won't pull the value out of the object since it needs to be an
        // object anyway when we pass it to this.translate as the isTemplate argument
        let population = this.game.COLONY.ui.getDescriptor();
        // We describe the lighting conditions based on the power level
        let powerlevel = Math.ceil(event.powerlevel/2);

        this.addMessage(this.translate(STRINGS["POWERLEVEL"+powerlevel], population), NOTIFICATIONS.POWER);
    }

    /**
     * Adds a message to the log regarding changes to meeples
     * @param {TheColonyEvent} event - the meeplemodified event of the TheColony object
     */
    meepleUpdate(event){

    }
}