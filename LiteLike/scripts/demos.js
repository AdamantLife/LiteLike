"use strict";

import * as IO from "./io.js";
import * as EQUIP from "./items.js";
import * as UTILS from "./utils.js";
import {CombatCharacter, roles} from "./character.js";
import {Combat, CharacterAction, actiontypes} from "./combat.js";
import {HUNGERRATE} from "./colony.js";
import * as MAP from "./map.js";

function toggleAllButtons(disabled){
    for (let button of document.querySelectorAll("#menu>button")) button.disabled = disabled;
}

function clearDemoBox(){
    let demoBox = document.getElementById("demoBox");
    while(demoBox.lastElementChild) demoBox.lastElementChild.remove();
}

function combatDemo(){
        // Disable all buttons to avoid shenanigans
        toggleAllButtons(true);
        clearDemoBox();

        document.getElementById("demoBox").insertAdjacentHTML("beforeend", `<div id="fightBox"></div>`);
        
        // Get the output space
        let fightbox = document.getElementById("fightBox");

        // Make sure fightbox is clear (if this was run previously)
        while(fightbox.lastChild) fightbox.lastChild.remove();

        // Create a new player Character
        GAME.PLAYER = GAME.startingCharacter().getCombatCharacter();
        
        // Create Enemy
        let enemy = new CombatCharacter(1, [roles.CHARACTER, roles.ENEMY],
            {
                "hp": 7,
                "currentHP": 7
            },
            {
                "weapons": [new EQUIP.Weapon(GAME.ITEMS.weapons[1])],
                "armor": GAME.ITEMS.armor[0],
                "items":[]
            });


        /**
         * Creates a Table on the Homepage outlining the character's stats
         * @param {Character} chara - The character to output
         */
        function outputCharacter(chara){
            // Get the description of the Character in the current Language
            let string = IO.getStrings(GAME.STRINGS, chara);

            // Display Character's Statistics
            fightbox.insertAdjacentHTML(`beforeend`,`
    <table id="player${chara.id}">
        <tbody>
            <tr>
                <td colspan=2><h1 title="${string.flavor}">${string.name}</h1></td>
            </tr>
            <tr>
                <td><b>HP:</b></td>
                <td title="Current HP"><span  id="player${chara.id}hp">${chara.statistics.currentHP}</span> <i title="Max HP">(${chara.statistics.hp})</i></td>
            </tr>
        </tbody>
    </table>`
            );

            // Getting a reference to the created html table so we can add
            // more Character Information to it
            let body = document.querySelector(`#player${chara.id}>tbody:first-of-type`);

            // Display all the Character's weapons
            // We're using the index so we can reference it later
            for(let i = 0; i < chara.weapons.length; i++){

                // Get weapon from index
                let weapon=chara.weapons[i];

                // Use getStrings to get name and flavor text for the current weapon
                let strings = IO.getStrings(GAME.STRINGS, weapon);
                
                // Display weapon statistics
                body.insertAdjacentHTML(`beforeend`, `
    <tr class="weapon" data-index="${i}">
        <td><b>Weapon</b></td>
        <td><span title="${strings.flavor}">${strings.name}</span></td>
        <td class="state">Available</td>
    </tr>`
            );
            }

            // Display Armor Statistics
            string = IO.getStrings(GAME.STRINGS, chara.armor);
            body.insertAdjacentHTML(`beforeend`,`
    <tr>
        <td><b>Armor</b></td>
        <td><span title="${string.flavor}">${string.name}</span></td>
    </tr>`
            );

            // Display all the Character's Items
            // We're using the index so we can reference it later
            for(let i = 0; i < chara.items.length; i++){

                // Get actual item
                let item = chara.items[i];

                // Use getStrings to get name and flavor text for the current item
                let strings = IO.getStrings(GAME.STRINGS, item);
                
                // Display item statistics
                // TODO: Once we start doing css, change quantity to a span with font-style
                body.insertAdjacentHTML(`beforeend`, `
    <tr class="item" data-index="${i}">
        <td><b>Item</b></td>
        <td><span title="${strings.flavor}">${strings.name} <i class="quantity">(Qty:${item.quantity})</i></span></td>
        <td class="state"></td>
    </tr>`
                );
            }

        }
        /* End outputCharacter*/

        // Output both character's stats
        outputCharacter(GAME.PLAYER);
        outputCharacter(enemy);

        // Create a log
        fightbox.insertAdjacentHTML('beforeend',`<ul id="fightlog"></ul>`);
        // Could get it via document.getElementById #preference
        let fightlog = fightbox.querySelector("#fightlog");

       
        GAME.COMBAT = new Combat(GAME.PLAYER, enemy);

        /**
         * AI to control the player during the demo
         * @param {Event} event - The Combat Event callback
         */
        function playerAI(event){
            let action = null;
            // Combat is over, do nothing
            if(event.combat.victor !== null) return;

            let player = event.player;

            // Character is pretty injured, heal if we can
            if(player.statistics.currentHP <= player.statistics.hp / 2 &&
            player.items.length // Player's only item is 1 repair bot in this demo
            ){
                action = new CharacterAction(player, actiontypes.ITEM, player.items[0], event.enemy);
            }else{ // Either the Player is not badly injured or it cannot heal anymore
                // So just attack (if we can)
                // Copied from enemy AI
                let weapon =player.firstFireableWeapon();
                // If no weapon is immediately fireable, use the first available one instead
                weapon = weapon ? weapon : player.firstAvailableWeapon();
                // If the player has a weapon it can use, use it
                if(weapon) action = new CharacterAction(player, actiontypes.WEAPON, weapon, event.enemy);
            }

            // Stick action on PlayerQueue if we have one
            if (action) event.combat.playerQueue.push(action);
        }


        /**
         * Utility funciton to output the given string to the fightlog
         * @param {String} log - What to write to the fightlog
         */
        function outputToFightLog(log){
            fightlog.insertAdjacentHTML('beforeend', `<li class="logitem">${log}</li>`);
        }

        /**
         * Output weapon attacks to the homepage
         * @param {Event} event 
         */
        function useWeapon(event){
            // Find out who's using the weapon and what it is
            let charaname = IO.getStrings(GAME.STRINGS, event.action.activator).name;
            let weaponname = IO.getStrings(GAME.STRINGS, event.action.object).name;

            // Check if it is dealing damage
            // Note that weapons cannot deal 0 damage, so !event.damage
            // signifies that the weapon is charging
            if(event.damage){
                // Get the opponent
                let opponame = IO.getStrings(GAME.STRINGS, event.action.opponent).name;

                // Log the Damage
                outputToFightLog(`${charaname} attacks ${opponame} with ${weaponname} for ${event.damage}`);
            }else{
                // Only other option right now is that the weapon started charging
                outputToFightLog(`${charaname} started charging his ${weaponname}`);
            }
        }

        /**
         * Output item usage to the homepage
         * @param {Event} event 
         */
        function useItem(event){
            // Find out who's using what item
            let charaname = IO.getStrings(GAME.STRINGS, event.action.activator).name;
            let itemname = IO.getStrings(GAME.STRINGS, event.action.object).name;

            outputToFightLog(`${charaname} activated ${itemname}`);

        }

        /**
         * Updates the UI to correct all weapon and item states and Character HP
         * @param {Event} event 
         */
        function updateWeaponsItemsHP(event){

            // For each character, update their weapon and item stats
            for(let chara of [event.combat.player, event.combat.enemy]){

                // The Players stat table
                let table = document.getElementById(`player${chara.id}`);

                // Update HP
                table.querySelector(`#player${chara.id}hp`).textContent = chara.statistics.currentHP;

                // Update weapons
                for(let i = 0; i < chara.weapons.length; i++){
                    // HTML Table Cell for the weapon state
                    let stateele = table.querySelector(`tr.weapon[data-index="${i}"]>td.state`);
                    // Default state is READY
                    let state = "READY";
                    // Get the actual weapon
                    let weapon = chara.weapons[i];
                    // Check if the weapon is on Cooldown
                    if(weapon.cooldown !== EQUIP.weaponstates.READY){
                        state = "ON COOLDOWN";
                    }else
                    // Check if the weapon is charging
                    if(weapon.isCharging()){
                        state = "CHARGING";
                    }else
                    // If warmup is not ready, output the warmup state
                    // warmup will always be READY for non-charging weapons
                    if(weapon.warmup != EQUIP.weaponstates.READY){
                        state = weapon.warmup;
                    }

                    stateele.textContent = state;
                }

                // Update Items
                for(let i = 0; i< chara.items.length; i++){
                    // Get Item instance
                    let item = chara.items[i];
                    // Get the item's output row (as state and quantity will
                    // both need to be updated)
                    let row = table.querySelector(`tr.item[data-index="${i}"]`);

                    // Update Quantity
                    // TODO- once we start actually doing CSS, quantity should
                    // change to a span and we'll set the font-style to italics there
                    let quant = row.querySelector("i.quantity");
                    quant.textContent = item.quantity;

                    // Update State
                    let state = row.querySelector("td.state");
                    // Items are a lot easier than Weapons...
                    state.textContent = item.cooldown ? "On Cooldown" : "Ready";
                }
            }
        }

        /**
         * Posts the results of combat on the page
         * @param {Event} event 
         */
        function endCombat(event){
            // Do a final update for the stats
            updateWeaponsItemsHP(event);

            // Get the victor's name and give them credit
            let victorname = IO.getStrings(GAME.STRINGS, event.combat.victor).name;
            outputToFightLog(`${victorname} is the Victor!`);

            // Re-enable all buttons
            toggleAllButtons(false);
        }

        GAME.COMBAT.addEventListener("startloop", playerAI);
        GAME.COMBAT.addEventListener("useweapon", useWeapon);
        GAME.COMBAT.addEventListener("useitem", useItem);
        GAME.COMBAT.addEventListener("endstack", updateWeaponsItemsHP);
        GAME.COMBAT.addEventListener("endcombat", endCombat);

        GAME.COMBAT.combatLoop();
    }

function meepleDemo(){
    // Disable all buttons to avoid shenanigans
    toggleAllButtons(true);
    clearDemoBox();

    // Create a new TheColony
    GAME.COLONY = GAME.initializeColony();

    // Create our personal demo area
    document.getElementById("demoBox").insertAdjacentHTML("beforeend", `<div id="meepleBox"></div>`);

    // Get a reference to the meepleBox for ease of use
    let meepleBox = document.getElementById("meepleBox");
    
    // Add a Table to display the Resources we've collected
    meepleBox.insertAdjacentHTML("beforeend", `<h3>Resources</h3><table id="resources"><tbody></tbody></table>`);

    // Get a reference to the Table Body to add items to it
    let resourceBody = document.querySelector("#resources>tbody");

    // Prepopulate the Table with all possible resoruces in the Game
    for(let [id, resource] of Object.entries(GAME.ITEMS.resources)){

        // Getting Strings to display on the GUI
        let restring = IO.getStrings(GAME.STRINGS, resource);

        // Create a row for the resource which displays its name and quantity (with Flavor Text on hover)
        resourceBody.insertAdjacentHTML("beforeend", `<tr data-id="${id}"><td title="${restring.flavor}">${restring.name}</td><td data-quantity>0</td></tr>`);
    }

    // It's easier for Job management to have a list of jobs available
    // and their associated strings
    let jobs = {};
    for (let job of GAME.JOBS){
        jobs[job.id] = {job, strings:IO.getStrings(GAME.STRINGS, job)};
    }

    // Create a Table for Displaying Meeple
    meepleBox.insertAdjacentHTML("beforeend", `<h3>Meeples</h3><table id="meeple"><thead><tr><th></th><th>Job</th><th>Hunger</th><th>Job</th></tr></thead><tbody></tbody>`);

    // Getting a reference to the Table's Body so we can add Meeple to it
    let meepleBody = document.querySelector("#meeple>tbody");

    // We're going to  initial all the Meeple's timers to the same time using now
    let now = UTILS.now();
    // For the sake of debugging, we're going to give all Meeple an ID
    var meepleindex = 0;
    
    /**
     * Creates a new Meeple and adds it to the UI
     * @param {Number} now - performance.now; what time to use to initialize the Meeple's Timers
     */
    function addMeeple(now){
        // If now is not provided, get the current time
        if(!now || typeof now === "undefined") now = UTILS.now();
        // Use the builtin function to create and get a reference to a new meeple
        let meeple = GAME.COLONY.addNewMeeple(now);
        // Meeple normally don't have ID's, so we're supplying them with one
        meeple.id = meepleindex;
        // Increment index for next meeple
        meepleindex+=1;
        
        // Add Row to meepleBody for this meeple
        meepleBody.insertAdjacentHTML("beforeend", `<tr data-id="meeple${meeple.id}"><td style="font-weight:bold;">${meeple.id}</td><td><span data-timer="job">0</span>/${meeple.job.collectionTime}</td><td><span data-timer="hunger">0</span>/${HUNGERRATE}</td><td><select data-job></select></td></tr>`);
        
        // Get and full in the Job Select form
        let select = meepleBody.lastElementChild.querySelector("select[data-job]");
        for(let job of Object.values(jobs)){
            // Each job gets its own option
            select.insertAdjacentHTML(`beforeend`, `<option value="${job.job.id}" title="${job.strings.flavor}">${job.strings.name}</option>`);
        }
        // The Meeple's default job is Job-index 0, so we select the very first option
        select.querySelector("option").selected = true;

        // Attaching an eventListener to update the Meeple's Job to match the UI
        select.addEventListener("change",
        (event)=>{
            meeple.assignJob( // When the Job index changes, we change the Meeple's Job
            jobs[event.target.selectedIndex].job // Since we are keeping all the jobs in ID order
                                          // we can just use selectIndex to get the job
            // we will let assignJob take care of calling now() (we won't supply it)
            );
        });
    }

    // Prepopulate the Demo with 5 meeple
    for(let i = 0; i < 5; i++){
        addMeeple(now);
    }

    /**
     * At the end of each colonyLoop, update the GUI to match TheColony instance
     * @param {Event} event - The event passed by Colony.eventlistener(endupdate)
     */
    function updateGUI(event){

        // Update Resources possessed by TheColony
        let resources = GAME.COLONY.resources;

        // Iterate through each index (which is also each Resource's ID)
        for(let i = 0; i < resources.length; i++){
            // get the quantity
            let qty = resources[i];
            // There is no qty value for the resource
            // NOTE- this shouldn't actually happen in this demo because we prepopulate
            //      with all possible resources
            if(qty === null || typeof qty === "undefined")continue;
            // Get the Table Row with the Resource's ID
            let row = resourceBody.querySelector(`tr[data-id= "${i}"]`);
            // Get the Cell with with the data-quantity attribute and set
            // it to show the current quantity
            row.querySelector("td[data-quantity]").textContent = qty;
        }

        let meeples = GAME.COLONY.meeples;

        // Remove Dead meeple
        // Start by getting a list of living meeple
        let livingmeeples = [];
        for(let meeple of meeples) livingmeeples.push(meeple.id);

        // Check each meeple onscreen
        for(let row of meepleBody.querySelectorAll(`tr[data-id^="meeple"]`)){
            // Extract ID from data-id string
            let id = parseInt(/meeple(\d+)/.exec(row.dataset.id)[1]);
            // Meeple is dead if his id is not in the list
            if(livingmeeples.indexOf(id) < 0) row.remove();
        }
        
        // Update Meeple's Timers
        for(let meeple of meeples){
            // Get Meeple's Row
            let row = meepleBody.querySelector(`tr[data-id="meeple${meeple.id}"]`);
            // Get the Job Timer Cell for that row and update it
            row.querySelector(`span[data-timer="job"]`).textContent = meeple.jobTimer.getOffsetTime(event.now).toFixed(3);
            // Get the Hunger Timer Cell for that row and update it
            row.querySelector(`span[data-timer="hunger"]`).textContent = meeple.hungerTimer.getOffsetTime(event.now).toFixed(3);
        }
        
        
    }

    /**
     * Quits the demo, ending the loop and disabling all Demo Controls
     * before re-enabling the Main Screen Demo Buttons
     */
    function finishDemo(){
        // Stop the colonyLoop
        window.clearTimeout(GAME.COLONY.loopid);
        // Disable Buttons
        document.getElementById("addmeeple").disabled = true;
        document.getElementById("quitmeeple").disabled = true;;
        // Disable all Job Selects
        for(let select of meepleBody.querySelectorAll("tr>td>select")){
            select.disabled = true;
        }
        // Re-Enable The Run-Demo buttons
        toggleAllButtons(false);
    }

    // Button to add More Meeple
    meepleBox.insertAdjacentHTML("beforeend", `<button id="addmeeple">Add Meeple</button>`);
    // Button to End the Demo
    meepleBox.insertAdjacentHTML("beforeend", `<button id="quitmeeple">Quit Demo</button>`);

    // Addmeeple expects a now() component, so we have to wrap it to get rid of the event
    document.getElementById("addmeeple").onclick = (e)=>addMeeple();
    document.getElementById("quitmeeple").onclick = finishDemo;

    // Register for the endupdate event that fires at the end of each colonyLoop
    // and update the GUI at that time
    GAME.COLONY.addEventListener("endupdate", updateGUI);

    // Begin the Demo by starting the colonyLoop
    GAME.COLONY.colonyLoop();
    
}

function mapDemo(){
    
}

var DEMOBUTTONS = {
    "startCombat": {text:"Start Combat Demo", target: combatDemo},
    "startMeeple": {text:"Start Meeple Demo", target: meepleDemo},
    "startMap": {text: "Start Map Demo", target: mapDemo}
    };

let menu = document.getElementById("menu");
for(let [id,info] of Object.entries(DEMOBUTTONS)){
    menu.insertAdjacentHTML('beforeend',`<button id="${id}"">${info.text}</button>`);
    document.getElementById(id).onclick = info.target;
}