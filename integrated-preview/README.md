# Integrated game candidate

This is a separate copy of the installed rental-review game with the regional building overlay on the map. It does not replace port 8766, and it does not change the building overlay on port 8767.

From the repository folder:

```bash
python3 integrated-preview/server.py --port 8774
```

Open http://127.0.0.1:8774/ or http://localhost:8774/ .

The page keeps the rental review that is already installed: a sample application does not charge, the bond is six weeks, approval waits one game hour, and a later confirmation pays the bond. The newer bottom tabs and the post-apply Property History screen are not in this candidate.

A tap on one of our building shapes opens the game property card. It shows the stable game id and, where the frozen file has one, the game estimate. It does not show an owner, and it does not offer a rental. Sample pins stay labelled as samples. Grey overlaps have no estimate and no listing. The map loads the buildings in view. The whole council outline does not load every footprint at once.

The map key stays in the same private file the other previews use. This server returns it only to this localhost port.

Old click selections saved as `yp-` ids are left untouched and are not turned into buildings. Fictional town lots stay on their own records. A sample pin stays a sample, with the id prefix `preview:`, and is not treated as an owner-created listing. There is no shared lock between players.

The screenshots from this cloud run use a plain background because no live map key was loaded in the test. The label on those images says so.
