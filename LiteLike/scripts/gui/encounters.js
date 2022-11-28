"use-strict";

import * as ENCOUNTERS from "../encounters.js";
import * as COMBATGUI from "./combat.js";
import * as REWARDSGUI from "./reward.js";

/**
 * Convenience function to clear the Event Popup (before populating)
 * and return a reference to it for use
 * 
 * @returns {Element} - a reference to the Event Popup
 */
 export function clearEvents(){
    // Get Box
    let eventBox = document.getElementById("events");
    // Clear box of all child elements
    while(eventBox.lastElementChild) eventBox.lastElementChild.remove();
    // Return so calling function doesn't have to look for it
    return eventBox;

}

/**
 * Makes sure the #events div is shown
 */
export function showEvents(eventBox){
    if(!eventBox || typeof eventBox == "undefined") eventBox = document.getElementById("events");

    // If box is hidden, remove hidden
    if(eventBox.classList.contains("hidden")) eventBox.classList.remove("hidden");

    // If box is not shown, add show
    if(!eventBox.classList.contains("shown")) eventBox.classList.add("shown");
}

/**
 * Populates the GUI for the current Encounter in the provided EncounterSequence and removes unneeded Elements.
 * If Sequence.get does not return an Encounter, the Combat and Event windows will be cleaned up.
 * 
 * @param {ENCOUNTERS.Encounter | null} - The Sequence to populate the GUI with. Can be null/false in order to just run the cleanup
 * @returns { [ENCOUNTERS.Encounter, ENCOUNTERS.EncounterOptions] | [null, null]} - Returns the encounter and it
 */
export function updateSequenceGUI(encounter){

    let eventBox = document.getElementById("events");
    let combatBox = document.getElementById("combat");
    // Establish any popups are currently visible so we know how to handle them
    let currentPopups = {
        combat: combatBox.classList.contains("shown"),
        event: eventBox.classList.contains("shown")
    }


    function encounterCleanup(){
        // Clear out the eventBox
        clearEvents();

        eventBox.classList.remove("shown");
        eventBox.classList.add("hidden");
    }

    function combatCleanup(){        
        // Hide combatBox
        combatBox.classList.remove("shown");
        combatBox.classList.add("hidden");
    }

    // No more encounters
    if(!encounter || typeof encounter == "undefined"){

        // Combat is currently being show, so hide it
        if(currentPopups.combat)combatCleanup;

        // A non-Combat encounter is bing shown, so hide it
        if(currentPopups.event) encounterCleanup();
        // Exit
        return [null, null];
    }

    // Get EncounterOptions so we can setup the GUI
    let result = encounter.getOptions();
    let gui;
    // Load the appropriate gui with callback
    switch(encounter.type){
        case ENCOUNTERS.encountertype.COMBAT:
            gui = new COMBATGUI.CombatGui(result);
            gui.loadCombat();
            // If we have a non-combat popup, clear it
            if(currentPopups.event) encounterCleanup();
            // We're returning here so we can auto-hide the Combat Popup
            // if it is up for all other encounter types
            return [encounter, result];

        case ENCOUNTERS.encountertype.CHOICE:
            // Use loadChoice to display it on the screen
            loadChoice(result);
            break;
        case ENCOUNTERS.encountertype.MESSAGE:
            // Use loadMessage to display it on the screen
            loadMessage(result);
            break;
        case ENCOUNTERS.encountertype.CALLBACK:
            // Use loadCallback to display it on the screen
            loadCallback(result);
            break;
        case ENCOUNTERS.encountertype.REWARD:
            gui = new REWARDSGUI.RewardsGui(result);
            gui.loadRewardEvent();
            break;
    }
    // Any other type of encounter is Non-Combat, so hide the Combat div
    if(currentPopups.combat) combatCleanup();

    return [encounter, result];
}

/**
 * Formats the event box for MessageEncounters.
 * @param {ENCOUNTERS.EncounterOptions} encounteroptions- The return of MessageEncounter.initEncounter
 * @param {String} encounteroptions.message - The message to display
 * @param {String} [encounteroptions.exitbutton=Continue] - The label for the exit button
 * @param {Function} encounteroptions.onexit - The function called when the exit button is pushed
 */
export function loadMessage(encounteroptions){
    // Get and clear Event box
    let eventBox = clearEvents();
    let buttontext = encounteroptions.exitbutton;
    if(!buttontext || typeof buttontext == "undefined") buttontext = "Continue";

    eventBox.insertAdjacentHTML('beforeend',`<p>${encounteroptions.message}</p><button id="eventexit">${buttontext}</button>`);
    // Attach the exit callback
    let onexit = encounteroptions.game.cycleEncounter.bind(encounteroptions.game);
    if(encounteroptions.onexit && typeof encounteroptions.onexit !== "undefined") onexit = encounteroptions.onexit;
    eventBox.querySelector("#eventexit").onclick = ()=>onexit();

    // Show event box if it isn't already
    showEvents(eventBox);
}

/**
 * Formats the event box for CallbackEncounters.
 * NOTE: CallbackEncounter is a subclass of MessageEncounter, so this simply wraps loadMessage
 * @param {ENCOUNTERS.EncounterOptions} encounteroptions- The return of MessageEncounter.initEncounter
 * @param {String} encounteroptions.message - The message to display
 * @param {Function} encounteroptions.callback - The Callback to call after the message is displayed
 * @param {String} [encounteroptions.exitbutton=Continue] - The label for the exit button
 * @param {Function} [encounteroptions.onexit] - The function called when the exit button is pushed
 */
 export function loadCallback(encounteroptions){
    loadMessage(encounteroptions);
    encounteroptions.callback();
}

/**
 * Formats the event box for ChoiceEncounters.
 * @param {ENCOUNTERS.EncounterOptions} encounteroptions- The return of ChoiceEncounter.initEncounter
 * @param {String} encounteroptions.Message - The message to display
 * @param {String} [encounteroptions.exitbutton=Continue] - The label for the exit button
 * @param {Function} [encounteroptions.onexit] - The function called when the exit button is pushed
 * @param {Choice[]} encounteroptions.choices - The available options to choose from
 */
 export function loadChoice(encounteroptions){
    // Get and clear Event box
    let eventBox = clearEvents();
    let buttontext = encounteroptions.exitbutton;
    // In terms of display, sometimes it's better for Choice Encounters to not display the exit button
    // and rather use an option as the exitbutton instead. This is indicated by passing false;
    if((!buttontext && buttontext !== false) || typeof buttontext == "undefined") buttontext = "Continue";

    eventBox.insertAdjacentHTML('beforeend',`<p>${encounteroptions.message}</p><table><tbody class="choicetable"></tbody></table>${buttontext ? `<button id="eventexit">${buttontext}</button>`: ``}`);

    // Populate the Choice Table
    let body = eventBox.querySelector("tbody.choicetable");
    for(let i = 0; i < encounteroptions.choices.length; i++){
        // We'll be populating the table in two columns using modulo
        // Even Numbers (including zero) are in the first column, so a new row needs to be made
        if(i%2 == 0) body.insertAdjacentHTML("beforeend", `<tr></tr>`);

        let choice = encounteroptions.choices[i];
        // LastElementChild should be the last/current row in body
        body.lastElementChild.insertAdjacentHTML("beforeend", `<td><button>${choice.flavor}</button></td>`);
        // Get reference to button
        let button = body.lastElementChild.querySelector("td:last-of-type>button");
        // Set Button callback in the last/most-recent td
        button.onclick = ()=>encounteroptions.callback(choice);
        // Check if player can afford the costs
        for(let cost of choice.cost){
            // Figure out where we're in the Player's inventory the Object is
            // and get the Player's availabilty of the item
            let available;
            if(cost.constructor.name == "Item") available = encounteroptions.game.PLAYER.getItem(cost.type.id);
            else if(cost.constructor.name == "Resource") available = encounteroptions.game.PLAYER.getResource(cost.type.id);

            // Player doesn't have any or has less than the cost
            // so can't choose this option
            if(!available || available.quantity < cost.qty){
                button.disabled = true;
                // Exit loop since we have no need to check any more costs
                break;
            }
        }
    }

    // Because ChoiceEncounters have alternative exit paths, it's possible to skip the onexit button
    if(encounteroptions.exitbutton !== false){
        // Otherwise, attach the exit callback
        let onexit = encounteroptions.game.cycleEncounter.bind(encounteroptions.game);
        if(encounteroptions.onexit && typeof encounteroptions.onexit !== "undefined") onexit = encounteroptions.onexit;
        eventBox.querySelector("#eventexit").onclick = ()=>onexit();
    }
    

    // Show event box if it isn't already
    showEvents(eventBox);
}