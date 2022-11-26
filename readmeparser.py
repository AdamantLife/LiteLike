import re
import datetime
import dataclasses
import pathlib

@dataclasses.dataclass
class Session:
    number: int
    segments: list["Segment"] = dataclasses.field(default_factory=list)

    def sum(self):
        return sum((segment.duration for segment in self.segments), start=datetime.timedelta())
    
@dataclasses.dataclass
class Segment:
    start: datetime.datetime
    end: datetime.datetime = None

    @property
    def duration(self):
        return self.end - self.start

SERE = re.compile("^#+?\s*Session\s*(?P<sessionnumber>\d+)")
DTRE = re.compile("^\s*\*\s*(?P<datetime>(?P<date>(?P<month>\d+)-(?P<day>\d+)-(?P<year>\d+))\s+(?P<time>(?P<hour>\d+):(?P<minute>\d+)\s*(?P<apm>am|pm)))-\s*(?P<type>[Ss]tart|[Ee]nd)\s*$")

def parse(file: str = None):
    if file is None:
        file: pathlib.Path = (pathlib.Path.cwd() / "README.md").resolve()
    else: file = pathlib.Path(file).resolve()
    if not file.exists():
        raise FileNotFoundError(f"Could not load file {file}")
    
    sessions = []    
    with open(file, 'r') as f:
        
        while (line := f.readline()):
            if (result := SERE.search(line)):
                ## Sanity checking
                if sessions and sessions[-1].segments and not sessions[-1].segments[-1].end:
                    raise RuntimeError(f"Did not parse a complete Segment prior to new Session: {line}")
                sessions.append(Session(int(result.group("sessionnumber"))))
                continue
            if (result := DTRE.search(line)):
                dt = result.group("datetime")
                dt = datetime.datetime.strptime(dt, "%m-%d-%Y %I:%M%p")
                if result.group("type").lower() == "start":
                    ## Sanity checking
                    if sessions[-1].segments and not sessions[-1].segments[-1].end:
                        raise RuntimeError(f"Did not parse a complete Segment prior to new Segment: {line}")
                    sessions[-1].segments.append(Segment(dt))
                    continue
                else:
                    ## Sanity checking
                    if sessions[-1].segments[-1].end:
                        raise RuntimeError(f"Parsed a duplicate Segment End prior to: {line}")
                    sessions[-1].segments[-1].end = dt

    from pprint import pprint
    for session in sessions:
        print(f"Session {session.number}")
        print(f">>> {session.sum()}")

    print("Total Time:")
    delta:datetime.timedelta = sum((session.sum() for session in sessions), start=datetime.timedelta)
    hours = delta.total_seconds() / 60 / 60
    print(f"    {hours}")

if __name__ == "__main__":
    path = (pathlib.Path(__file__).parent / "README.md").resolve()
    parse(path)