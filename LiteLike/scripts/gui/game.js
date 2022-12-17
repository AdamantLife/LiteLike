"use-strict";

import { loadSave, saveFile, makeTranslationLookup } from "../io.js";
import { enumerate } from "../utils.js";

export class GameGUI{
    // Generic Translations
    STRINGS = enumerate(
        // None
        "NONE",
        // Equipment Types
        "RESOURCES", "ITEMS", "WEAPONS", "ARMOR", "TRANSPORTS",
        // Game Management
        "NEW", "SAVE", "LOAD", "QUIT"
    )

    constructor(game, demos){
        this.game = game;
        if(typeof demos == "undefined") demos = null;
        this.demos = demos;

        this.translate = makeTranslationLookup(this.game, this.STRINGS, "game");
    }

    get menu(){ return document.getElementById("menu"); }
    get gamewindow(){ return document.getElementById("gamewindow"); }
    
    setupUI(){
        document.body.insertAdjacentHTML("afterbegin", `<div id="menu" class="menu">
        <div id="mainmenu" class="menu">
            <button id="playbutton">${this.translate(this.STRINGS.NEW)}</button>
            <label>${this.translate(this.STRINGS.LOAD)}<input id="loadbutton" type="file" accept=".json"></input></label>
        </div>
    </div><div id="gamewindow"></div>`)
        document.getElementById("playbutton").onclick = this.newGame.bind(this);
        document.getElementById("loadbutton").addEventListener("change", this.loadSave.bind(this));
        if(this.demos) this.demos(this.game);
    }

    exitToMainMenu(){
        this.game.exitGame();
        while(this.gamewindow.lastElementChild) this.gamewindow.lastElementChild.remove();
        this.menu.style.display = "block";
    }

    newGame(){
        this.menu.style.display = "none";
        this.game.newGame();
        this.game.COLONY.colonyLoop();
    }

    loadSave(event){
        loadSave(event.target.files[0]).then(
            game=>{
                this.menu.remove();
                window.GAME = game;
                game.setupUI(this.demos);
                game.UI.setupUI();
                game.UI.menu.style.display = "none";
                game.setupGameplayUI();
                game.COLONY.colonyLoop();
            }
        )
    }

    saveGame(){
        saveFile(window.GAME);
    }

    traverseMainMenu(target){
        for(let child of this.menu.children) child.style.display="none";
        document.getElementById(target).style.display = "block";
    }

}