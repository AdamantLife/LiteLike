"use strict";

import * as UTILS from "./utils.js";

// State of the weapon based on Warmup and Cooldown
const weaponstates = UTILS.enumerate(
    "CHARGING", // The weapon is warming up
    "CHARGED", // The weapon was previously Charged and now is ready to deal damage
    "FIRED", // The Weapon was previously Ready, Charged, or Charging and now needs its Cooldown updated
    "READY" // The Weapon is off of cooldown and off of warmup
    );

/**
 * A class for describing attack options
 */
class WeaponType{
    /**
     * 
     * @param {Number} id - An integer
     * @param {Number} damage - An integer amount of damage the weapon deals
     * @param {Number} cooldown - A float representing the amount of time the interval
     *                              required between uses
     * @param {*} warmup - A float representing how long a weapon takes to inflict damage
     *                      after it has been activated
     */
    constructor(id, damage, cooldown, warmup){
        this.id = id;
        this.damage = damage;
        this.cooldown = cooldown;
        this.warmup = warmup;
    }
}

/**
 * A specific instance of a WeaponType
 */
class Weapon {
    /**
     * 
     * @param {WeaponType} weapontype - This weapon's WeaponType, which determines its base statistics
     */
    constructor(weapontype){
        this.weapontype = weapontype;
        this.cooldown = null;
        this.warmup = null;
    }

    /**
     * Returns whether the weapon is available to used
     */
    isAvailable(){
        // The weapon is not on cooldown
        return this.cooldown === null
    }

    /**
     * Updates cooldown and warmup states
     */
    updateState(){
        let now = UTILS.now();
        // If this.cooldown is not null, check if we can reset it
        if(this.cooldown !== weaponstates.READY){
            // If the difference between now and when the weapon cooldown was timestamped
            // is longer than the weapontype's cooldown, we are no longer on cooldown
            if((now - this.cooldown) > this.weapontype.cooldown) this.cooldown = null;
        }

        // If this.warmup is not null, we may need to update it
        if(this.warmup !== weaponstates.READY){
            // Weapon warmup timer has been started
            if(this.warmup === weaponstates.CHARGING){
                // Weapon is done warming up
                if(this.warmupRemaining(now) <= 0) this.warmup = weaponstates.CHARGED;
            }
            // The weapon was previously in the CHARGED state and has since been fired
            else if(this.warmup === weaponstates.FIRED){
                this.warmup = weaponstates.READY;
            }
        }
    }

    warmupRemaining(now){

    }
}