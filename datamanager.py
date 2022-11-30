## GUI
import tkinter as tk
from tkinter import ttk

## Backend
import json
import pathlib

def getrelativepath(path):
    return (pathlib.Path.cwd() / path).resolve()

class Pane(ttk.Frame):
    def __init__(self, master, *args, **kw) -> None:
        super().__init__(master, *args, *kw)
        self.master = master
    def packall(self, *args, **kw):
        for child in self.winfo_children():
            child.pack(*args, **kw)
    def clearall(self):
        for child in self.winfo_children():
            child.destroy()

    def loadpage(self, callback):
        self.clearall()
        callback()

class Main(Pane):
    def __init__(self, parent, **kw):
        super().__init__(parent, **kw)

        ttk.Label(self, text="LiteLike Data Manager", font = ("Times", 20, "bold"))

        for [window, text] in [
            [Colony, "Colony"],
            [Items, "Items"],
            [Encounters, "Encounters"],
            [Characters, "Characters"]
        ]:
            ttk.Button(self, text = text, command = lambda window = window: self.load(window))

        self.packall()

        
    def load(self, window):
        window(self.master).pack(fill='both', expand=True)
        self.destroy()

class DataLoader():
    def loaddata(self):
        with open(getrelativepath(self.JSON), 'r') as f:
            self.data = json.load(f)
    def loadenglish(self):
        with open(getrelativepath("LiteLike/strings/english.json"), 'r', encoding="utf-8") as f:
            self.english = json.load(f)
    def savedata(self):
        with open(getrelativepath(self.JSON), 'w') as f:
            json.dump(self.data, f)
    def saveenglish(self):
        with open(getrelativepath("LiteLike/strings/english.json"), 'w', encoding="utf-8") as f:
            json.dump(self.english, f)
    def getenglish(self, category, index):
        return self.english[category][index]
    
    def showindex(self):
        f = Pane(self)
        self.treeview = ttk.Treeview(f, show="tree")
        for (category, values) in self.data.items():
            self.treeview.insert("", "end", iid=category, text=category.capitalize(), open=True)
            for _id, item in enumerate(values):
                self.treeview.insert(category, "end", iid=f"{category}-{_id}", text=self.getenglish(category, _id)['name'])
        scroll = tk.Scrollbar(f, orient='vertical', command=self.treeview.yview)
        self.treeview['yscrollcommand']= scroll.set
        f.packall(side='left', fill='y')
    
class CategoryPage(Pane, DataLoader):
    def __init__(self, master, *args, title= None, **kw) -> None:
        super().__init__(master, *args, **kw)
        self.loaddata()
        self.loadenglish()
        ttk.Label(self, text=title, font=("times", 20, "bold"))
        self.showindex()
        self.packall()
        ttk.Button(self, text="Back", command = self.loadmain).place(in_=self, x=0,y=0,anchor="nw")
        

    def loadmain(self):
        Main(self.master).pack(fill='both', expand=True)
        self.destroy()

class Colony(CategoryPage):
    JSON = "LiteLike/entities/colony.json"
    def __init__(self, master, *args, **kw) -> None:
        super().__init__(master, *args, title="Colony", **kw)

class Items(CategoryPage):
    JSON = "LiteLike/entities/items.json"
    def __init__(self, master, *args, **kw) -> None:
        super().__init__(master, *args, title = "Items", **kw)

class Encounters(Pane, DataLoader):
    JSON = "LiteLike/entities/encounters.json"
    def __init__(self, master, *args, **kw) -> None:
        super().__init__(master, *args, **kw)
        self.loaddata()
        self.loadenglish()
        ttk.Label(self, text="Encounters", font=("times", 20, "bold"))
        self.treeview = ttk.Treeview(self, show="tree")
        for [category, languagename] in [
            ["combatants", "character"],
            ["noncombat", "encounter"]
        ]:
            self.treeview.insert("", "end", iid=category, text=category.capitalize(), open=True)
            for _id, item in enumerate(self.data.get(category, [])):
                self.treeview.insert(category, "end", iid=f"{category}-{_id}", text=self.getenglish(languagename, item['name'])['name'])
        self.treeview.insert("", "end", iid="tiers", text = "Tiers", open=True)
        for i in range(len(self.data['tiers'])):
            self.treeview.insert("tiers", 'end', iid=f"tier-{i}", text= f"Tier {i}")
        self.packall()
        ttk.Button(self, text="Back", command = self.loadmain).place(in_=self, x=0,y=0,anchor="nw")

    def loadmain(self):
        Main(self.master).pack(fill='both', expand=True)
        self.destroy()

class Characters(Pane, DataLoader):
    JSON = None
    def __init__(self, master, *args, **kw) -> None:
        super().__init__(master, *args, **kw)
        self.loadenglish()
        ttk.Label(self, text="Characters", font=("times", 20, "bold"))
        self.treeview = ttk.Treeview(self, show="tree")
        for _id, item in enumerate(self.english['character']):
            self.treeview.insert("", "end", iid=str(_id), text=item['name'])
        self.packall()
        ttk.Button(self, text="Back", command = self.loadmain).place(in_=self, x=0,y=0,anchor="nw")

    def loadmain(self):
        Main(self.master).pack(fill='both', expand=True)
        self.destroy()


        
if __name__ == "__main__":
    root = tk.Tk()
    Main(root).pack(fill='both', expand=True)
    root.mainloop()