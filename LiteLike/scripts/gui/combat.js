import * as COMBAT from "../combat.js";
import * as ITEMS from "../items.js";

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
        weaponstable.querySelector(`td[data-slot${i}]`).insertAdjacentHTML('beforeend',`<button title="${weaponstring.flavor}">${weaponstring.name}</button>`);
        weaponstable.querySelector(`td[data-slot${i}]>button`).onclick = ()=>COMBATGUI.useWeapon(combat.player, weapon, combat.enemy);
    }
    let itemstable = combatBox.querySelector(`div[data-combatant="player"] table[data-loadout="items"]`);
    for(let i = 0; i < CHARA.CHARAITEMLOADOUT; i++){
        let item = combat.player.items[i];
        // No Items at loadout slot
        if(!item || typeof item == "undefined") continue;
        let itemstring = IO.getStrings(GAME.STRINGS, item);
        itemstable.querySelector(`td[data-slot${i}]`).insertAdjacentHTML('beforeend', `<button title="${itemstring.flavor}">${itemstring.name}</button>`);
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
    // Register combat with GAME
    GAME.COMBAT = combat
    // Setup the Combat div
    initializeCombatBox(combat);

    // Add listeners
    combat.addEventListener("endcombat", finishCombat);
    // GUI Updates
    combat.addEventListener("warmup", updateInput);
    combat.addEventListener("damage", updateInput);
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
 * @param {Evenet} event - Character.currentHPchange event
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