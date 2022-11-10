"use strict";

import {toggleAllButtons, clearDemoBox} from "./utils.js";
import * as IO from "../scripts/io.js";
import * as EQUIP from "../scripts/items.js";
import {CombatCharacter, roles} from "../scripts/character.js";
import {Combat, CharacterAction, actiontypes} from "../scripts/combat.js";

export function combatDemo(){
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
                if(!weapon.cooldown.isReady){
                    state = "ON COOLDOWN";
                }else
                // Check if the weapon is charging
                if(weapon.isCharging()){
                    state = "CHARGING";
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

    GAME.COMBAT.prepareCombat();
    GAME.COMBAT.combatLoop();
}