"use-strict";

import * as COMBAT from "../combat.js";
import * as ITEMS from "../items.js";
import * as CHARACTER from "../character.js";
import * as IO from "../io.js";
import * as GUI from "./site.js";

/**
 * @typedef {Object} WeaponEvent
 * @param {COMBAT.Combat} combat - The Combat object
 * @param {CombatCharacter} player - The player character
 * @param {CombatCharacter} enemy - The enemy character
 * @param {Number} time - The time at which the event is taking place
 * @param {CharacterAction} action - The weapon action
 * @param {Weapon} weapon - The weapon used in the weapon action
 * @param {"warmup" | "damage"} result - What the weapon action is doing
 * @param { null | Number } damage - If the result is damage, how much damage is going to be done (without event interference)
 */

/**
     * Clears the Combat Div and returns a reference to it
     * @returns {Element} - The Combat Div
     */
 export function clearCombat(){
    let combatBox = document.getElementById("combat");
    while (combatBox.lastElementChild) combatBox.lastElementChild.remove();
    return combatBox;
}

/**
 * Removes all evnet listeners for combat from the provided game
 * @param {Game} game - The GAME object
 */
 function cleanupCombat(game){
    // Incase this is called accidently
    if(!game.COMBAT || game.COMBAT == "undefined") return;
    // Clear all listeners
    game.COMBAT.removeAllListeners();
    game.COMBAT.player.removeAllListeners();
    game.COMBAT.enemy.removeAllListeners();
    // Clear combat from Game
    game.COMBAT = null;
}


/**
 * Clears the finished animation classes
 */
 function clearAnimation(event){
    switch(event.animationName){
        case "playerswing":
            document.querySelector(`#combat>div[data-combatant="player"]`).classList.remove("swing");
            break;
        case "enemyswing":
            document.querySelector(`#combat>div[data-combatant="enemy"]`).classList.remove("swing");
            break;
        case "playerprojectile":
        case "enemyprojectile":
        case "laser":
            event.srcElement.remove();
            break;
    }
}

export class CombatGui{
    constructor(encounteroptions){
        this.encounteroptions = encounteroptions;
    }
    get game(){ return this.encounteroptions.game; }
    get combat(){ return this.encounteroptions.combat; }

    /**
     * 
     * INPUT
     * 
     */


    useWeapon(character, weapon, opponent){
        this.combat.playerQueue.push(new COMBAT.CharacterAction(character, COMBAT.actiontypes.WEAPON, weapon, opponent));
    }

    useItem(character, item, opponent){
        this.combat.playerQueue.push(new COMBAT.CharacterAction(character, COMBAT.actiontypes.ITEM, item, opponent));
    }

    /**
     * Handles hotkeys for Combat
     * @param {Event} event - The keypress event triggering this callback
     */
    handleCombatKeyPress(event){
        
    }

    /**
     * 
     * COMBAT GUI SETUP
     * 
     */

    /**
         * Creates a Character's Stat Block for display in the Combat Window
         * @param {CHARACTER.Character} chara - Character to get display strings for
         * @param {Boolean} weapons - Whether or not to display the weapons table
         * @param {Boolean} items - Whether or not to display the items table
         * @returns {String} - an html string to insert into the Combat Window
         */
    buildStatBlock(chara, weapons, items){
        let charaString = IO.getStrings(this.game.STRINGS, chara);

        let weapontable = weapons ? `<h3>Weapons</h3>
        <table data-loadout="weapons"><tbody>
        <tr><td data-slot0></td><td></td><td data-slot1></td></tr>
        <tr><td></td><td data-slot2></td><td></td></tr>
        <tr><td data-slot3></td><td></td><td data-slot4></td></tr>
        </tbody></table>` : ""

        let itemtable = items ? `<h3>Items</h3>
        <table data-loadout="items"><tbody>
        <tr><td data-slot0></td><td data-slot1></td><td data-slot2></td></tr>
        </tbody></table>` : "";

        return `
    <div class="character" data-combatant="${chara.roles.indexOf(CHARACTER.roles.PLAYER) >= 0 ? "player" : "enemy"}">
    <div><h1 class="charactername" title="${charaString.flavor}">${charaString.name}</h1><h1>&nbsp;</h1></div>
    <table class="boldfirst"><tbody>
    <tr><td>HP</td><td><div style="display:inline-block;position:relative;width:3em;">&nbsp;<div data-hp style="position:absolute;width:100%;text-align:right;top:0;">${chara.statistics.currentHP}</div></div><div style="display:inline-block;">/${chara.statistics.hp}</div></td></tr>
    </tbody></table>
    ${weapontable}
    ${itemtable}
    </div>`;
    }

    /**
     * Initializes the combatBox for the given combat
     * If combatBox needs to be displayed/unhidden, that should be done separately
     */
    initializeCombatBox(){

        let combatBox = clearCombat();

        // Clear combatBox
        while(combatBox.lastElementChild) combatBox.removeChild(combatBox.lastElementChild);
        // Insert Player Character
        combatBox.insertAdjacentHTML('beforeend', this.buildStatBlock(this.combat.player, true, true));
        // Insert Enemy Character
        // NOTE: currently we are never displaying weapons or items for enemy
        combatBox.insertAdjacentHTML('beforeend', this.buildStatBlock(this.combat.enemy, false, false));

        // Loadout population is repetative, so we're combining everything
        // We start out per-character
        for(let character of [this.combat.player, this.combat.enemy]){
            // Get weapons and items table to populate for the character
            let weaponstable = combatBox.querySelector(`div[data-combatant="${character == this.combat.player ? 'player': 'enemy'}"] table[data-loadout="weapons"]`);
            let itemstable = combatBox.querySelector(`div[data-combatant="${character == this.combat.player ? 'player': 'enemy'}"] table[data-loadout="items"]`);

            // Both tables are popuplated the same way, but we need to know where to find the loadout,
            // how much of each loadout to populate, and what happens when the button is pushed
            for( let [table, loadout, loadoutlength, callback] of [
                [weaponstable, character.weapons, CHARACTER.CHARAWEAPONLOADOUT, this.useWeapon.bind(this)],
                [itemstable, character.items, CHARACTER.CHARAITEMLOADOUT, this.useItem.bind(this)]
            ]){
                // If table is not displayed, skip populating the loadout
                // NOTE: Currently we are never displaying the enemy weapons or items
                if(!table) continue

                // Populate each object of the loadout
                for(let i = 0; i < loadoutlength; i++){
                    // Get the object to populate
                    let object = loadout[i];

                    // That slot is empty
                    if(!object || typeof object == "undefined") continue;

                    // Get readable strings
                    let strings = IO.getStrings(this.game.STRINGS, object);

                    // Add Activation button and progress (warmup/cooldown) bar
                    table.querySelector(`td[data-slot${i}]`).insertAdjacentHTML('beforeend',`
        <button title="${strings.flavor}">${strings.name}</button><div class="progressbar"><div class="inner"></div></div>
        `);
                    // Connect button to callback
                    let button = table.querySelector(`td[data-slot${i}]>button`)
                    button.onclick = ()=>callback(character, object, character == this.combat.player ? this.combat.enemy : this.combat.player);
                    // If this is a weapon, add the player's ammunition quantity on over
                    if(typeof object.weapontype !== "undefined" && object.weapontype.requiresAmmunition){
                        // Get resource object from player
                        let ammo = character.getResource(object.weapontype.ammunition);
                        // Character may not have ammo for this weapon
                        if(!ammo){
                            // Get the ResourceType from the game
                            ammo = this.game.RESOURCES[object.weapontype.ammunition];
                        }
                        // Get Ammo name to display
                        let ammunition = IO.getStrings(this.game.STRINGS, ammo);

                        // Convert to quantity
                        // If this is a ResourceType, it will not have a quantity, so set to 0
                        ammo = typeof ammo.quantity == "undefined " ? 0 : ammo.quantity;
                        // Update hover text
                        button.title = `${ammunition.name}: ${ammo}`;
                        
                        // If player doesn't have ammo, disable button so weapon cannot be used
                        if(!ammo) button.disabled = true; 
                    }
                    // If this is an item, add its qunatity on hover
                    else if(typeof object.itemtype !== "undefined"){
                        // Add item quantity to hover text                    
                        button.title = `Qty: ${Math.ceil(object.quantity)}`;
                        // If we have no quantity of the item, disable it
                        if(!object.quantity) button.disabled = true;
                    }

                    // Start combat with just the activation button visable
                    table.querySelector(`td[data-slot${i}]>div.progressbar`).style.display = "none";
                }

            }

        }
        

        
    }

    /**
     * Assigns a combat object to GAME and begins the screen transition
     * to the Combat Popup
     */
    loadCombat(){
        let combatBox = document.getElementById("combat");
        let player = this.combat.player;
        let enemy = this.combat.enemy;
        // Register combat with GAME
        this.game.COMBAT = this.combat
        // Setup the Combat div
        this.initializeCombatBox();
        this.combat.prepareCombat();

        // We'll be attaching listeners to the character boxes and names
        let playerBox = combatBox.querySelector(`div[data-combatant="player"]`);
        let enemyBox = combatBox.querySelector(`div[data-combatant="enemy"]`);

        // Add listeners
        this.combat.addEventListener("endcombat", this.cleanupCombat.bind(this));
        // GUI Updates
        this.combat.addEventListener("useweapon", this.updateInput.bind(this));
        this.combat.addEventListener("useitem", this.updateInput.bind(this));
        //      These callbacks are to reenable the item when cooldown is done
        player.addEventListener("equipmentchange", this.updateInput.bind(this));
        player.addEventListener("itemschange", this.updateInput.bind(this));

        player.addEventListener("currentHPchange", this.combatUpdateHP.bind(this));
        enemy.addEventListener("currentHPchange", this.combatUpdateHP.bind(this));
        this.combat.addEventListener("characterko", this.combatKOUpdate.bind(this));
        // Animations
        this.combat.addEventListener("useweapon", this.animateAttack.bind(this));
        playerBox.addEventListener("animationend", clearAnimation);
        enemyBox.addEventListener("animationend", clearAnimation);

        

        // Remove Hidden class
        combatBox.classList.remove("hidden");
        // Listen for the next animation to end
        combatBox.addEventListener("animationend", this.startCombat.bind(this));
        // Add Shown class which will begin animating
        combatBox.classList.add("shown");
    }

    /**
     * Callback for the .popup.shown animation: removes the listener and starts the combatloop
     * @param {Event} event - The animationend event
     */
    startCombat(event){
        // Stop listening for animations on Combat
        document.getElementById("combat").removeEventListener("animationend", this.startCombat.bind(this));
        // Start Combatloop
        this.combat.combatLoop();
    }

    /**
     * COMBAT GUI CLEANUP
     * 
     */

    /**
     * Removes all listeners and calls encounteroptions.onexit
     * @param {CombatEvent} event - The endcombat event
     */
    cleanupCombat(event){
        // Remove listeners
        cleanupCombat(this.game);
        // Call onexit
        this.encounteroptions.onexit(this.combat);
    }

    /**
     * 
     * COMBAT GUI UPDATES
     * 
     */

    /**
     * Updates the displayed HP in response to HP change events
     * @param {Event} event - Character.currentHPchange event
     */
    combatUpdateHP(event){
        // Figure out which character was hit
        let chara = event.character == this.combat.player ? "player": "enemy";
        // Get box
        let box = document.querySelector(`#combat div[data-combatant="${chara}"]`);
        // Update hp
        let hp = box.querySelector("div[data-hp]")
        hp.textContent = event.currentHP;
        // Set color based on hp change (red = Damage, green = Heal)
        let color = event.rawchange < 0 ? "#f00" : "#0f0";
        // Flash HP to indicate hp change
        GUI.flashText(hp, {duration : 250, color});
        GUI.swellText(hp, {duration : 250*3});
    }

    /**
     * Updates the display based on who was ko'd
     * @param {Event} event - Combat.characterko event
     */
    combatKOUpdate(event){
        let character = event.character == this.combat.player ? "player" : "enemy";
        // Get the box for the character
        let box = document.querySelector(`#combat>div[data-combatant="${character}"]`);
        // Set death class on character
        box.classList.add("dead");
        // Disable all buttons for character
        for(let button of box.getElementsByTagName("button")) button.disabled = true;
    }

    /**
     * Callback to update the input gui for items and weapons
     * @param {WeaponEvent | ItemEvent} event - The weapon event for the weapon
     */
    updateInput(event){

        // We'll ignore character.equipmentchange-> warmup (ready flag set) because
        // we're more interested in when Combat clears the warmup ready flag
        if(event.eventtype == CHARACTER.Character.EVENTTYPES.equipmentchange && event.item.constructor.name == "Weapon" && event.timer == "warmup") return;

        // We need to establish these variables to know what we are updating
        // subtype is "warmup", "activated", or "cooldown"
        // the rest should be self-explanatory
        let character, objecttype, object, subtype;

        switch(event.eventtype){
            case CHARACTER.Character.EVENTTYPES.equipmentchange:
                // this event originates from the character itself
                character = event.character;
                // Object is under event.item
                object = event.item;
                // make sure that objecttype is weapon
                objecttype = object.constructor.name ==  "Weapon"? "weapon" : null;
                // Subtype is listed for this event
                subtype = event.timer;
                break;
            case CHARACTER.Character.EVENTTYPES.itemschange:
                // this event originates from the character itself
                character = event.character;
                // this should be a weapon event
                objecttype = "item";
                // Weapon is under event.item
                object = event.item;
                // Subtype is listed for this event
                subtype = event.timer;
                break;
            case COMBAT.Combat.EVENTTYPES.useweapon:
                // These are combat events, so refer to the characteraction
                character = event.action.activator;
                // These are weapon events
                objecttype = "weapon";
                // weapon is under event.action.object
                object = event.action.object;
                // Subtype can be determined based on result
                subtype = event.result == "warmup" ? "activated" : "warmup";
                break;
            case COMBAT.Combat.EVENTTYPES.useitem:
                // This is a combat event, so refer to the cahracteraction
                character = event.action.activator;
                // This is an item event
                objecttype = "item";
                // Object is under event.item
                object = event.item;
                // Subtype is always "warmup" atm
                subtype = "warmup";            
        }    
        // We are currently not displaying enemy weapon/item use
        if(character == this.combat.enemy) return;

        // Determine the loadout based on objecttype
        let loadout;
        if(objecttype == "weapon") loadout = character.weapons;
        else if (objecttype == "item") loadout = character.items;
        // Per usual, return on errors
        else{ return; }

        // Find out what the object's index is
        let index = loadout.indexOf(object);

        // Figure out which character we're dealing with
        let charactername = character == this.combat.player ? "player" : "enemy";

        // We'll want a reference to the table data cell
        let td = document.querySelector(`#combat div[data-combatant="${charactername}"] table[data-loadout="${objecttype}s"] td[data-slot${index}]`);

        // The button to use/activate/attack with the weapon/item
        let button = td.querySelector("button");
        // Get the outer part of the progressbar so we can show/hide it
        let progbar = td.querySelector("div.progressbar");
        // Get the inner (colored) part of the progressbar so we can set its animation time
        // to correspond to warmup/cooldown
        let inner = progbar.querySelector("div.inner");

        // Item has been activated, so start warmup
        if(subtype == "activated"){
            // Hide and disable button
            button.style.display = "none";
            button.disabled = true;
            // Show progbar
            progbar.style.display = "block";
            // Set progbar duration to warmup time
            inner.style.animationDuration = object.warmup.rate+"ms";
            // Make sure progbar does not have warmup or cooldown classes
            // (it shouldn't, but just in case)
            progbar.classList.remove("warmup", "cooldown");
            // Set progbar to show warmup
            progbar.classList.add("warmup");
        }
        // Item has finished warmup, so begin cooldown
        else if (subtype == "warmup"){
            // Button should already be hidden and disabled, but just in case
            button.style.display = "none";
            button.disabled = true;
            // Likewise, progbar should already be Shown
            progbar.style.display = "block";
            // Set progbar duration to cooldown time
            inner.style.animationDuration = object.cooldown.rate+"ms";
            // Make sure progbar does not have warmup or cooldown classes
            progbar.classList.remove("warmup", "cooldown");
            // Set progbar to show cooldown
            progbar.classList.add("cooldown");
        }
        // Item has finished cooldown, so reenable
        else if (subtype == "cooldown"){
            // Show and enable button
            button.style.display = "inline-block";
            // If character is not ko'd reenable button
            button.disabled = character.isKOd();
            // Hide progbar
            progbar.style.display = "none";
            // We're not going to bother to change duration

            // Make sure progbar does not have warmup or cooldown classes
            progbar.classList.remove("warmup", "cooldown");

            // Weapon specific checks
            if(objecttype == "weapon"){
                // If weapon is no longer fireable, disable it
                if(!object.isFireable()) button.disabled = false;

                // Update weapon's ammunition if it has it
                if(object.weapontype.requiresAmmunition){
                    // Get resource object from player
                    let ammo = character.getResource(object.weapontype.ammunition);
                    // Get Ammo name to display
                    let ammunition = IO.getStrings(this.game.STRINGS, ammo);
                    // Convert to quantity
                    ammo = ammo ? ammo.quantity : 0;
                    // Update hover text
                    button.title = `${ammunition.name}: ${ammo}`;
                }
            }
            // Item specific check
            else if(objecttype == "item"){
                // Update quantity
                button.tile = `Qty: ${Math.ceil(object.quantity)}`;
                // If no more quantity left, disable button
                if(!object.quantity) button.disabled = true;
            }
            
        }
        // As usual, don't do anything on invalid data
        else{ return; }
    }

    /**
     * 
     * ANIMATIONS
     * 
     */

    /**
     * Delegates the animation of an attack action
     * inside of the #combat div to the correct animator
     * @param {WeaponEvent} event - The WeaponEvent being animated
     */
    animateAttack(event){
        // Animates Melee Swings and Non-Laser Ranged Attacks
        if(event.result == "warmup") return this.animateWarmup(event);
        // Only Animates Laser Damage
        if(event.result == "damage") return this.animateDamage(event);
    }

    /**
     * Animates the warmup event for the given weapontype
     * @param {WeaponEvent} event - The WeaponEvent being animated
     */
    animateWarmup(event){
        function animateSwing(){
            let characterblock = document.querySelector(`#combat>div[data-combatant="${character}"]`);
            let charactername = document.querySelector(`#combat>div[data-combatant="${character}"] h1.charactername`);

            charactername.style.animationDuration=event.action.object.warmup.rate+"ms";
            characterblock.classList.add("swing");
        }

        function animateProjectile(){
            let characterblock = document.querySelector(`#combat>div[data-combatant="${character}"]`);
            characterblock.insertAdjacentHTML('afterbegin', `<div class="projectile" style="animation-duration:${weapontype.warmup}ms">o</div>`)
        }

        let character = event.action.activator == this.combat.player ? "player" : "enemy";
        

        // We refer to this repeatedly
        let weapontype = event.action.object.weapontype
        let range = ITEMS.weaponranges[weapontype.range];

        // Melee warmups are swings
        // TODO: should probably fix this, but we'll deal with it later
        if(range == ITEMS.weaponranges.MELEE) return animateSwing();
        // Projectile/Ammunition weapons' warmup is the projectile travel time
        if(weapontype.requiresAmmunition && range !== ITEMS.weaponranges.LASER) return animateProjectile();
    }


    /**
     * Animates damage being dealt
     * @param {WeaponEvent} event - The WeaponEvent being animated
     */
    animateDamage(event){
        if(ITEMS.weaponranges[event.action.object.weapontype.range] == ITEMS.weaponranges.LASER){
            let character = event.action.activator == this.combat.player ? "player" : "enemy";
            let characterblock = document.querySelector(`#combat>div[data-combatant="${character}"]`);
            characterblock.insertAdjacentHTML('afterbegin', `<div class="laser" style="animation-duration:${event.action.object.weapontype.warmup}ms"></div>`)
        }
    }
}
