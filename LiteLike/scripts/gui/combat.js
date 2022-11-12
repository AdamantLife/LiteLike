import * as COMBAT from "../combat.js";
import * as ITEMS from "../items.js";
import * as CHARACTER from "../character.js";

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
 * 
 * INPUT
 * 
 */

/**
 * 
 */
export function useWeapon(character, weapon, opponent){
    GAME.COMBAT.playerQueue.push(new COMBAT.CharacterAction(character, COMBAT.actiontypes.WEAPON, weapon, opponent));
}

export function useItem(character, item, opponent){
    GAME.COMBAT.playerQueue.push(new COMBAT.CharacterAction(character, COMBAT.actiontypes.ITEM, item, opponent));
}

/**
     * Handles hotkeys for Combat
     * @param {Event} event - The keypress event triggering this callback
     */
 export function handleCombatKeyPress(event){
    // There is no combat going on, so can't handle hotkeys
    if(!GAME.COMBAT) return;
}

/**
 * 
 * COMBAT GUI SETUP
 * 
 */
/**
 * Initializes the combatBox for the given combat
 * If combatBox needs to be displayed/unhidden, that should be done separately
 * @param {COMBAT.Combat} combat - the combat being initialized
 */
 export function initializeCombatBox(combat){

    function buildStatBlock(chara){
        let charaString = IO.getStrings(GAME.STRINGS, chara);
        return `
<div class="character" data-combatant="${chara.roles.indexOf(CHARA.roles.PLAYER) >= 0 ? "player" : "enemy"}">
<h1 title="${charaString.flavor}">${charaString.name}</h1>
<table class="boldfirst"><tbody>
<tr><td>HP</td><td><span data-hp>${chara.statistics.currentHP}</span>/${chara.statistics.hp}</td></tr>
</tbody></table>
<h3>Weapons</h3>
<table data-loadout="weapons"><tbody>
<tr><td data-slot0></td><td></td><td data-slot1></td></tr>
<tr><td></td><td data-slot2></td><td></td></tr>
<tr><td data-slot3></td><td></td><td data-slot4></td></tr>
</tbody></table>
<h3>Items</h3>
<table data-loadout="items"><tbody>
<tr><td data-slot0></td><td data-slot1></td><td data-slot2></td></tr>
</table></tbody>
</div>`
    }

    let combatBox = document.getElementById("combat");

    // Clear combatBox
    while(combatBox.lastElementChild) combatBox.removeChild(combatBox.lastElementChild);
    // Insert Player Character
    combatBox.insertAdjacentHTML('beforeend', buildStatBlock(combat.player));
    // Insert Enemy Character
    combatBox.insertAdjacentHTML('beforeend', buildStatBlock(combat.enemy));

    let weaponstable = combatBox.querySelector(`div[data-combatant="player"] table[data-loadout="weapons"]`);
    for(let i = 0; i < CHARA.CHARAWEAPONLOADOUT; i++){
        let weapon = combat.player.weapons[i];
        // No weapon at loadout slot
        if(!weapon || typeof weapon == "undefined") continue;
        let weaponstring = IO.getStrings(GAME.STRINGS, weapon);
        weaponstable.querySelector(`td[data-slot${i}]`).insertAdjacentHTML('beforeend',`<button title="${weaponstring.flavor}">${weaponstring.name}</button><div class="progressbar" data-duration></div>`);
        weaponstable.querySelector(`td[data-slot${i}]>button`).onclick = ()=>COMBATGUI.useWeapon(combat.player, weapon, combat.enemy);
    }
    let itemstable = combatBox.querySelector(`div[data-combatant="player"] table[data-loadout="items"]`);
    for(let i = 0; i < CHARA.CHARAITEMLOADOUT; i++){
        let item = combat.player.items[i];
        // No Items at loadout slot
        if(!item || typeof item == "undefined") continue;
        let itemstring = IO.getStrings(GAME.STRINGS, item);
        itemstable.querySelector(`td[data-slot${i}]`).insertAdjacentHTML('beforeend', `<button title="${itemstring.flavor}">${itemstring.name}</button><div class="progressbar" data-duration></div>`);
        itemstable.querySelector(`td[data-slot${i}]>button`).onclick = ()=>COMBATGUI.useItem(combat.player, item, combat.enemy);
    }
}

/**
     * Assigns a combat object to GAME and begins the screen transition
     * to the Combat Popup
     * @param {Combat} combat - The Combat object to load
     * @param {Function}  finishCombat - The callback to call when the combat is finished
     */
 export function loadCombat(combat, finishCombat){
    let combatBox = document.getElementById("combat");
    let player = combat.player;
    let enemy = combat.enemy;
    // Register combat with GAME
    GAME.COMBAT = combat
    // Setup the Combat div
    initializeCombatBox(combat);

    // Add listeners
    combat.addEventListener("endcombat", finishCombat);
    // GUI Updates
    combat.addEventListener("warmup", updateInput);
    combat.addEventListener("damage", updateInput);
    combat.addEventListener("useitem", updateInput);
    //      These callbacks are to reenable the item when cooldown is done
    player.addEventListener("equipmentchange", updateInput);
    player.addEventListener("itemschange", updateInput);
    enemy.addEventListener("equipmentchange", updateInput);
    enemy.addEventListener("itemschange", updateInput);

    combat.player.addEventListener("currentHPchange", combatUpdateHP);
    combat.enemy.addEventListener("currentHPchange", combatUpdateHP);
    // Animations
    combat.addEventListener("warmup", animateAttack);
    combat.addEventListener("damage", animateAttack);

    

    // Remove Hidden class
    combatBox.classList.remove("hidden");
    // Listen for the next animation to end
    combatBox.addEventListener("animationend", startCombat);
    // Add Shown class which will begin animating
    combatBox.classList.add("shown");
}

/**
 * Callback for the .popup.shown animation: removes the listener and starts the combatloop
 * @param {Event} event - The animationend event
 */
function startCombat(event){
    // Stop listening for animations on Combat
    document.getElementById("combat").removeEventListener("animationend", startCombat);
    // Start Combatloop
    GAME.COMBAT.combatLoop();
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
 function combatUpdateHP(event){
    // Figure out which character was hit
    let chara = event.character == GAME.COMBAT.player ? "player": "enemy";
    // Get box
    let box = document.querySelector(`#combat div[data-combatant="${chara}"]`);
    // Update hp
    box.querySelector("span[data-hp]").textContent = event.currentHP;
}

/**
 * Callback to update the input gui for items and weapons
 * @param {WeaponEvent | ItemEvent} event - The weapon event for the weapon
 */
function updateInput(event){
    // We'll ignore character.equipmentchange-> warmup (ready flag set) because
    // we're more interested in when Combat clears the warmup ready flag
    if(event.eventtype == CHARACTER.Character.EVENTTYPES.equipmentchange && event.type == "weapon" && event.subttype == "warmup") return;

    // We need to establish these variables to know what we are updating
    // subtype is "warmup", "activated", or "cooldown"
    // the rest should be self-explanatory
    let character, objecttype, object, subtype;

    switch(event.eventtype){
        case CHARACTER.Character.EVENTTYPES.equipmentchange:
            // this event originates from the character itself
            character = event.character;
            // Object type is under event.type
            objecttype = event.type;
            // Weapon is under event.item
            object = event.item;
            // Subtype is listed for this event
            subtype = event.subtype;
            break;
        case CHARACTER.Character.EVENTTYPES.itemschange:
            // this event originates from the character itself
            character = event.character;
            // this should be a weapon event
            objecttype = "item";
            // Weapon is under event.item
            object = event.item;
            // Subtype is listed for this event
            subtype = event.subtype;
            break;
        case COMBAT.Combat.EVENTTYPES.warmup:
        case COMBAT.Combat.EVENTTYPES.damage:
            // These are combat events, so refer to the characteraction
            character = event.action.activator;
            // These are weapon events
            objecttype = "weapon";
            // weapon is under event.weapon
            object = event.weapon;
            // Subtype can be determined based on eventtype
            subtype = event.eventtype == COMBAT.Combat.EVENTTYPES.warmup ? "warmup" : "activated";
            break;
        case COMBAT.Combat.EVENTTYPES.itemuse:
            // This is a combat event, so refer to the cahracteraction
            character = event.action.activator;
            // This is an item event
            objecttype = "item";
            // Object is under event.item
            object = event.item;
            // Subtype is always "activated" atm
            subtype = "activated";            
    }
    // Determine the loadout based on objecttype
    let loadout;
    if(objecttype == "weapon") loadout = character.weapons;
    else if (objecttype == "item") loadout = character.items;
    // Per usual, return on errors
    else{ return; }

    // Find out what the object's index is
    let index = loadout.indexOf(object);
    // Figure out which character we're dealing with
    character = character == GAME.COMBAT.player ? "player" : "enemy";
    // We'll want a reference to the table data cell
    let td = document.querySelector(`#combat div[data-combatant="${character}"] table[data-loadout="${objecttype}s"] td[data-slot${index}]`);

    // The button to use/activate/attack with the weapon/item
    let button = td.querySelector("button");
    // The progress bar which indicates both warmup and cooldown
    let progbar = td.querySelector("div.progressbar");

    // Item has been activated, so start warmup
    if(subtype == "activated"){
        // Hide and disable button
        button.style.display = "none";
        button.disabled = true;
        // Show progbar
        progbar.style.display = "initial";
        // Set progbar duration to warmup time
        progbar.dataset.duration = object.warmup.rate;
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
        progbar.style.display = "initial";
        // Set progbar duration to cooldown time
        progbar.dataset.duration = object.cooldown.rate;
        // Make sure progbar does not have warmup or cooldown classes
        progbar.classList.remove("warmup", "cooldown");
        // Set progbar to show cooldown
        progbar.classList.add("cooldown");
    }
    // Item has finished cooldown, so reenable
    else if (subttype == "cooldown"){
        // Show and enable button
        button.style.display = "initial";
        button.disabled = false;
        // Hide progbar
        progbar.style.display = "none";
        // We're not going to bother to change duration

        // Make sure progbar does not have warmup or cooldown classes
        progbar.classList.remove("warmup", "cooldown");
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
function animateAttack(event){
    if(event.result == "warmup") return animateWarmup(event);
    if(event.result == "damage") return animateDamage(event);
    // In theory, the result should only be one of the above two at the moment
    // and, as always, we aren't doing anything with errors
}

/**
 * Animates the warmup event for the given weapontype
 * @param {WeaponEvent} event - The WeaponEvent being animated
 */
function animateWarmup(event){
    function animateSwing(){

    }
    function animateCharge(){

    }
    if(event.weapon.weapontype.range == ITEMS.weaponranges.MELEE) return animateSwing();
    if(event.weapon.weapontype.range == ITEMS.weaponranges.RANGE) return animateCharge();
}


/**
 * Animates damage being dealt
 * @param {WeaponEvent} event - The WeaponEvent being animated
 */
function animateDamage(event){

}