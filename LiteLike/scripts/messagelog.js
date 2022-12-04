"use-strict";
import { enumerate } from "./utils.js";
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

export class MessageLog{
    constructor(game){
        this.game = game

        /** Colony Update Messages */
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
        let statpanel = document.getElementById("statuspanel");
        // Setup UI
        statpanel.insertAdjacentHTML("afterbegin", `<div id="messagebox" class="statusbox"><div class="header">System Log<button class="resize" style="margin-left: auto; margin-right:0px;"></button></div><div class="body"><div class="fadeoutmask"></div></div></div>`);
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
        documentdocument.querySelector("#messagebox>.body").insertAdjacentHTML('afterstart', `<ul>${message}</ul>`);
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
        SITEGUI.flashText(document.document.querySelector("#messagebox>.body").firstElementChild, {color: white, backgroundColor});
        // Flash the header too in case the messagebox is collapsed
        SITEGUI.flashText(document.querySelector("#messagebox>.header"), {color: white, backgroundColor});
    }

    /**
     * UPDATE CALLBACKS
     */

    /**
     * Adds a message to the log regarding changes to meeples
     * @param {ColonyEvent} event - the meeplemodified event of the TheColony object
     */
    meepleUpdate(event){

    }
}