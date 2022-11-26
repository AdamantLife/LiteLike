"use-strict";
import * as ENCOUNTERS from "../scripts/encounters.js";
import * as ENCOUNTERSGUI from "../scripts/gui/encounters.js";
import { Item, Resource } from "../scripts/items.js";

/**
 * Since the Map has a large number of Encounters, we've moved them over to this module to clean up the core mapdemo script
 */

/**
 * Generates the basic Space Bandit Combat Encounter for visiting Unexpored Outposts
 * @param {Function} finishCombat - Since Encounter Construction was moved to this module, the Map Demo's finishCombat function should be supplied
 * @param {Function} cycleEvent -Since Encounter Construction was moved to this module, the Map Demo's cycleEvent function should be supplied
 * @returns {ENCOUNTERS.EncounterSequence} - The EncounterSequence for the Bandit Combat Encounter (containing message, combat, and reward encounters)
 */
export function getBanditEncounter(finishCombat, cycleEvent){
    return ENCOUNTERS.buildCombatEncounter(GAME, 0, [{type: "Resource", id: 2, qty: 10}], cycleEvent, {message: "While exploring a derelict port you are ambushed by a Space Brigand!", combatexit: finishCombat});
}

/**
 * The EncounterSequence generated when The Colony is visited.
 * The first encounter (CallbackEncounter) results in the Player dropping all non-ammunition Resources
 * The second (RewardEncounter) allows the player to pick up a Geolocation Marker
 * Note that The Colony is also considered an Outpost in the Demo, so this will
 * be followed by that Encounter
 * * @param {Function} cycleEvent -Since Encounter Construction was moved to this module, the Map Demo's cycleEvent function should be supplied
 * @returns {ENCOUNTERS.Encounter} - The CallbackEncounter
 */
export function visitColony(cycleEvent){
    // To be lazy, we're just going to overwrite resources
    // DEVNOTE: in actual gameplay, resources would be transferred
    // to The Colony, but that is outside the scope of this demo
    function dropResources(){
        // Establish which resource the player needs to use his weapons
        let keep = [];
        // Iterate over the weapons
        for(let weapon of GAME.PLAYER.weapons){
            // If it needs ammunition, note the ammunition
            if(weapon.weapontype.requiresAmmunition) keep.push(weapon.weapontype.ammunition);
        }

        // Iterate over the Player's resources
        for(let key of Object.keys(GAME.PLAYER.resources)){
            // If resourceID in keep, do nothing
            if(keep.indexOf(parseInt(key)) >= 0) continue;
            // Otherwise, remove the resouce
            delete GAME.PLAYER.resources[key];
        }
    };
    
    // Build drop callback encounter
    let callback = new ENCOUNTERS.CallbackEncounter({
        game: GAME, 
        message: "Upon arrival in The Colony, the dockworkers unload the resources you've gathered",
        callback: dropResources,
        onexit: cycleEvent
    });

    // Build geo marker reward encounter
    let reward = new ENCOUNTERS.RewardEncounter({
        game: GAME,
        onexit: cycleEvent,
        rewards: [{type: "Resource", id: 5, qty: 1}]
    });

    //Return Sequence
    return new ENCOUNTERS.EncounterSequence([callback, reward]);
}

/**
 * Builds a new Sub Sequence when the Player enters a Port where the player can gather additional resources.
 * @param {Function} cycleEvent -Since Encounter Construction was moved to this module, the Map Demo's cycleEvent function should be supplied
 * @returns {ENCOUNTERS.EncounterSequence} - The Sub Sequence for the enterPort Map event 
 */
export function visitPort(cycleEvent){
    // Top Of (max out) the transport's reactorPower
    let callback = ()=>GAME.PLAYER.equipment.transport.topOff();

    // Create message encounter
    let message = new ENCOUNTERS.CallbackEncounter({game: GAME, message: "You arrive at port and retrieve a cache of supplies your allies had left for you.", callback, onexit: cycleEvent})
    // Create reward encounter
    let reward = new ENCOUNTERS.RewardEncounter({game: GAME, rewards:[{type: "Item", id: 0, qty: 5}], onexit: cycleEvent});
    
    return new ENCOUNTERS.EncounterSequence([message, reward]);
}

/**
 * "Randomly" generates a single floor (encounter) of the Station (see DEVNOTE on dungeonStationEvent)
 * @param {Number} floor - The floor the of the Station
 * @param {Number} maxFloor - The last floor; this is provided because the final floor is always a reward for clearing the Station
 * @param {Function} onexit - The onexit callback for the Encounter. Because these are dynamically created
 *                              by dungeonStationEvent, they have to be supplied when this function is called
 * @returns {ENCOUNTERS.EncounterSequence} - An EncounterSequence for that floor
 */
export function buildStation(floor, maxFloor, onexit){
    // We generate the dungeon based on the current floor
    // I think it's best to increment the difficulty every couple of floors
    let tier = Math.floor(floor / 2);

    let encounterSequence = new ENCOUNTERS.EncounterSequence([]);

    // Floor 0 is always an introductory message
    if(floor == 0){
        // NOTE: To reiterate the above DEVNOTE- all of these encounters would
        //          normally be randomly generated            
        let encounter= new ENCOUNTERS.MessageEncounter({game: GAME, message : "You happen upon a station. You dock with it to see how its inhabitants are fairing.", onexit})
        encounterSequence.addEncounter(encounter);
    }
    // Final Floor/Floor 5 is the reward for clearing the Station
    else if(floor == maxFloor){
        let callback = new ENCOUNTERS.CallbackEncounter({
            game: GAME,
            message: "As you prepare your ship to leave the Station, you are approached by a group of people pushing hoverpallets. They have heard of your exploits around The System and want to contribute to your cause.",
            onexit:()=>{encounterSequence.increment(); ENCOUNTERSGUI.updateSequenceGUI(encounterSequence);},
            callback: ()=>GAME.PLAYER.equipment.transport.topOff()
        });
        let reward = new ENCOUNTERS.RewardEncounter({
            game: GAME,
            exitbutton: "Leave the Station",
            // Since this is the final floor, make sure to clear the Station
            onexit: ()=>{GAME.MAP.clearStructureAtLocation(); onexit(true);},
            rewards: [{type: "Resource", id: 2, qty: 10}, {type: "Item", id: 0, qty: 10}],
        });
        encounterSequence.addEncounter(callback, reward);
    }
    // Tier 0 only has 1 Encounter because floor 0 is handled above
    else if(tier == 0){
        
        /**
         * Callback for this ChoiceEncounter
         * @param {Choice.value} value - The value of the selected choice
         */
        function traderCallback(choice){

            let callback = ()=>{
                // While value could stand for anything, in this case we can just use it as the selected quantity
                // Player is gauranteed to have these resources because the option was selectable
                GAME.PLAYER.getResource(2).quantity-= choice.value;
                // Here we're going to give the player the same amount of
                // resources unless he gets greedy
                let gain = choice.value;
                if(choice.value == 10) gain = 0;
                // Give the player the Resource
                GAME.PLAYER.getResource(1).quantity+= gain;
                // Trigger callback
                GAME.PLAYER.triggerEvent("resourceschange", {1: GAME.PLAYER.getResource(1), 2:GAME.PLAYER.getResource(2)});
            }

            // Message reflects the above note
            let message = "The Trader happily does business with you and gives you some especially high quality batteries.";
            if(choice.value == 10) message = "The Trader takes your scrap and says he'll be right back with your batteries.\r\n\r\n\r\n... You never see him again..."


            let encounter = new ENCOUNTERS.CallbackEncounter({
                game: GAME, 
                message,
                callback,
                onexit
            });

            // Add this encounter to this floor's EncounterSequence
            encounterSequence.addEncounter(encounter);

            // Load this new Encounter into the GUI
            encounterSequence.increment();
            ENCOUNTERSGUI.updateSequenceGUI(encounterSequence);

        }
        let encounter = new ENCOUNTERS.ChoiceEncounter({
            game: GAME,
            message: "You come across a trader willing to exchange scrap for batteries.",
            choices:[
                {value: 1, flavor: "Trade 1 Scrap for 1 Battery", cost:[{type:"Resource", id: 2, qty:1}]},
                {value: 5, flavor: "Trade 5 Scrap for 5 Batteries", cost:[{type:"Resource", id: 2, qty:5}]},
                {value: 10, flavor: "Trade 10 Scrap for 50 Batteries", cost:[{type:"Resource", id: 2, qty:10}]}
            ],
            exitbutton: "Do not Trade",
            onexit,
            callback: traderCallback
        });
        encounterSequence.addEncounter(encounter);
    }
    // Floors 2 and 3
    else if(tier == 1){
        // Repeating for the umpteenth time: only hardcoding per-floor because this is a demo
        if(floor == 2){
            let message = new ENCOUNTERS.MessageEncounter({
                game: GAME,
                message: "As you wander through the Station, you suddenly find yourself stepping out into a large, brightly lit area. Stretched out before you is a wide pitch of artificial grass. A group of children are noisily kicking around a ball. Some older residents are seated silently on a bench to your right. Dotted around the landscape are other citizens of the station engaging if various forms are recreation.\r\n\r\nYou hope to someday witness all these things happening on a planet’s surface.",
                onexit
            })
            encounterSequence.addEncounter(message);
        }
        else{
            function petitionCallback(choice){
                let message;
                if(choice.value == 1){
                    message = `"You are most generous, my son! I am certain The Blue Eyes will keep at least two of its eyes upon you in the near future. If you ever feel like its gaze might be wandering away from you, do be sure to return and I will happily again intercede on your behalf!"`;
                    // Pay cost and notify
                    GAME.PLAYER.getResource(2).quantity -= 5;
                    GAME.PLAYER.triggerEvent("resourceschange", {2:GAME.PLAYER.getResource(2)});
                }else{
                    message = `As you brush past the man he grumbles something.\r\n\r\nPart of you wonders if it was a curse...`
                }

                let encounter = new ENCOUNTERS.MessageEncounter({game: GAME, message: message, onexit: onexit});
            
                // Add this encounter to this floor's EncounterSequence
                encounterSequence.addEncounter(encounter);

                // Load this new Encounter into the GUI
                encounterSequence.increment();
                ENCOUNTERSGUI.updateSequenceGUI(encounterSequence);
                
            }

            let choice = new ENCOUNTERS.ChoiceEncounter({
                game: GAME,
                exitbutton: false,
                onexit,
                message: `A man in worn, grease-caked burlap reaches out to you as you round a corner.\r\n"Have you heard of The Blue Eyes of Gamma Centuri? It is a powerful deity who watches after spacefarers like yourself who devote themselves to his worship! It is ever vigilant and itercedes with its quantum energies to save its adherrants in their moment of dire peril! All that is required is that you help spread knowledge of it to other travellers."\rnThe misisonary presses a stinking bag towards your face. Inside is a lone Würf Token: the smallest denomination of this galaxy's currency.`,
                choices:[{value: 1, flavor: "Make a contribution to the religion", cost: [{type: "Resource", id: 2, qty: 5}]}, {value: 0, flavor: "Ignore the  and continue on your way", cost:[]}],
                callback: petitionCallback
            });

            encounterSequence.addEncounter(choice);
        }
    }
    // Floor 4 (floor 5- the max floor- is handled above)
    else if(tier == 2){
        function engageCallback(choice){
            let encounter ;
            // Chose to fight
            if(choice.value == 2) encounter = fight();

            // Gave the men your money
            else if(choice.value == 1) encounter = pay();

            else{
                // Tried to leave
                encounter = new ENCOUNTERS.ChoiceEncounter({
                    game: GAME,
                    exitbutton:false,
                    onexit,
                    message: `A man steps in front of you and shoves you back towards the group. Looking around, it seems like you took a scenic route back to the hanger; you do not see anyone else you can call out to.`,
                    choices:[
                        {value: 1, flavor: "Give them your money", cost:[]},
                        {value: 2, flavor: "Fight the goons", cost:[]}
                    ],
                    callback: fightCallback
                });
            }

            // Add this encounter to this floor's EncounterSequence
            encounterSequence.addEncounter(encounter);

            // Load this new Encounter into the GUI
            encounterSequence.increment();
            ENCOUNTERSGUI.updateSequenceGUI(encounterSequence);
        }

        function fightCallback(choice){
            let encounter;
            // Tried to fight
            if(choice.value == 2) encounter = fight();
            // Payed up
            else{ encounter = pay(); }

            // Add this encounter to this floor's EncounterSequence
            encounterSequence.addEncounter(encounter);

            // Load this new Encounter into the GUI
            encounterSequence.increment();
            ENCOUNTERSGUI.updateSequenceGUI(encounterSequence);
        }
        function pay(){
            let encounter = new ENCOUNTERS.MessageEncounter({
                game: GAME,
                onexit,
                message: `You were planning on topping off your transport before you left, but figure emergency medical care would cost more and hand them over your money.`
            })
            return encounter;
        }

        function fight(){
            let callback = ()=> GAME.PLAYER.adjustHP(-2);
            let encounter = new ENCOUNTERS.CallbackEncounter({
                game: GAME,
                onexit,
                message: `You decide it's been a while since the last time you got some excercize, so you throw a haymaker at the man standing in front of you. Off to a good start, you prepare take on the man to his left when one of the other men kick you in the back. You stumble forward and are immediately swarmed by the whole group.\r\nAfter minutes of being kicked and stomped, you vaguely feel someone patting your pants until he gets to the one with your wallet. A few minutes later you reawaken, realizing you lost consciousness at some point.\r\n\r\nYou realize you lost all your money as well.`,
                callback
            })

            return encounter;
        }
        let choice = new ENCOUNTERS.ChoiceEncounter({
            game: GAME,
            exitbutton:false,
            onexit,
            message: `As you head back to the hanger to leave you are surrounded by a group of rough-looking men. They ask you how much Rudel you have on you.`,
            choices:[
                {value: 0, flavor: "Attempt to leave.", cost:[]},
                {value: 1, flavor: "Give them your money", cost:[]},
                {value: 2, flavor: "Fight the goons", cost:[]}
            ],
            callback: engageCallback
        });
        
        encounterSequence.addEncounter(choice);
    }

    // Returning the generated EncounterSequence for the floor
    return encounterSequence;
}

/**
 * "Randomly" generates a single floor (encounter) of the Dungeon (see DEVNOTE on dungeonStationEvent)
 * @param {Number} floor - The floor the of the Dungeon
 * @param {Number} maxFloor - The last floor; this is provided because the final floor is always a reward for clearing the Station
 * @param {Function} onexit - The onexit callback for the Encounter. Because these are dynamically created
 *                              by dungeonStationEvent, they have to be supplied when this function is called
 * @returns {Encounter} - The encounter for that floor
 */
export function buildDungeon(floor, maxFloor, onexit){
    // We generate the dungeon based on the current floor
    // I think it's best to increment the difficulty every couple of floors
    let tier = Math.floor(floor / 2);

    let encounterSequence = new ENCOUNTERS.EncounterSequence();

    // Floor 0 is always an introductory message
    if(floor == 0){
        // NOTE: To reiterate the above DEVNOTE- all of these encounters would
        //          normally be randomly generated
        let encounter= new ENCOUNTERS.MessageEncounter({game: GAME, message:"You come across a planet.\r\nYour sensors indicate it possesses valuable resources so you decide to investigate.", onexit})
        encounterSequence.addEncounter(encounter);
    }
    // The last (max) floor always is a Boss Fight and Treasure Trove (reward)
    else if(floor == maxFloor){
        // Boss fight
        let combatsequence = new ENCOUNTERS.buildCombatEncounter(GAME, 2, [{type:"Resource", id:6, qty:8}],
                ()=>{encounterSequence.increment(); ENCOUNTERSGUI.updateSequenceGUI(encounterSequence);},
                {
                    message: "Your sensors indicate that you are within the vicinity of the crystal deposit you were looking for, but your gut tells you something is seriously wrong here. You carefully survey the area and a moment later you see it: a creature very similar to the ones you have been fending off, but nearly three times the size of the others. Had you continued towards your goal, it would have ambushed you from the ledge it is hiding on. But now its eyes lock with yours and it stands up, recognizing that it has been spotted and will have no easy meal today.",
                }
            );

        // Rewards
        let message = new ENCOUNTERS.MessageEncounter({
            game: GAME,
            message: "Having made your way past the monstrous animal, you finally arrive at the Auron Crystal cluster. The beast appears to have made this area its nest: you find the remains of several other mechs piled around the area. Evidently their pilots were not as skilled (or perhaps as lucky) as you.",
            onexit:()=>{encounterSequence.increment(); ENCOUNTERSGUI.updateSequenceGUI(encounterSequence);},
        });
        let reward = new ENCOUNTERS.RewardEncounter({
            game: GAME,
            exitbutton: "Leave the Station",
            // Since this is the final floor, make sure to clear the Dungeon
            onexit: ()=>{GAME.MAP.clearStructureAtLocation(); onexit(true);},
            rewards: [{type: "Resource", id: 2, qty: 20}, {type: "Item", id: 0, qty: 10}, {type: "Weapon", id:3, qty:1}],
        });
        encounterSequence.addEncounter(combatsequence,message, reward);
    }
    // Floor 1
    else if(tier == 0){
        let combatsequence = new ENCOUNTERS.buildCombatEncounter(GAME, 1, [{type:"Resource", id:3, qty:2}],
            ()=>{console.log(encounterSequence.index);encounterSequence.increment(); ENCOUNTERSGUI.updateSequenceGUI(encounterSequence);},
            {
                rewardexit: onexit
            }
        );
        encounterSequence.addEncounter(combatsequence);
        console.log(combatsequence.encounters.length);
        console.log(encounterSequence.encounters.length);
    }
    // Floors 2 and 3
    else if(tier == 1){
        // Per other notes, normally the floor would not be checked here, but we're hardcoding for the demo
        if(floor == 2){
            let combatsequence = new ENCOUNTERS.buildCombatEncounter(GAME, 1, [{type:"Resource", id:3, qty:2}],
                ()=>{encounterSequence.increment(); ENCOUNTERSGUI.updateSequenceGUI(encounterSequence);},
                {
                    rewardexit: onexit
                }
            );
            encounterSequence.addEncounter(combatsequence);
        }
        // DEVNOTE: In A Dark Room, the halfway encounter was an event asking you to light a Torch to continue
        //          We're using a "Geolocating Marker" (Resource 5)
        else{
            function markerCallback(choice){
                // There is only one choice and the player could only select it if he had a Geo Marker: just subtract it
                GAME.PLAYER.getResource(5).quantity -= 1;
                // Don't need to provide feedback, so just call onexit
                onexit();
            }

            // Geo Markers are resource 5
            let markers = GAME.PLAYER.getResource(5, true);
            // If markers is null, convert to 0
            markers = markers ? markers.quantity : 0;
            let choice = new ENCOUNTERS.ChoiceEncounter({
                game: GAME,
                // Retreating results in the Dungeon ending prematurely and not being counted as cleared
                onexit: ()=>onexit(true),
                exitbutton: "Retreat to Transport",
                message: "Being an experienced Wanderer, you know it's foolhardy to travel any further from your transport on this savage world without first setting up a Geolocating Marker.",
                choices: [{value:0, flavor: `Plant Marker (${markers} remaining)`, cost: [{type:"Resource", id:5, qty:1}]}],
                callback: markerCallback
            });
            encounterSequence.addEncounter(choice);
        }
    }
    // Floor 4 (floor 5 is taken care of above)
    else if(tier == 2){
        let combatsequence = new ENCOUNTERS.buildCombatEncounter(GAME, 1, [{type:"Resource", id:3, qty:2}],
                ()=>{encounterSequence.increment(); ENCOUNTERSGUI.updateSequenceGUI(encounterSequence);},
                {
                    rewardexit: onexit
                }
            );
            encounterSequence.addEncounter(combatsequence);
    }
    return encounterSequence;
}