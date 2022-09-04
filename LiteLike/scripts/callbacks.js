"use strict";

/**
 * Generic Callbacks
 * Mostly for items atm
 */

/**
 * Function factory which produces a "heal" type callback based on the input provided
 * @param {Character} target - Character to heal
 * @param {Number} value - Amount of HP to heal
 * @returns {combatCallback} - Returns the callback use
 */
function heal(target, value){
    return (activator, opponent)=>{
        let chara = activator;
        if(target == "OPPONENT") target = opponent;
        chara.statistics.hp = Math.min(chara.statistics.hp, chara.statistics.currentHP + value);
    }
}

export const callbacks = Object.freeze({HEAL:heal });