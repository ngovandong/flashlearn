import { FormHelperText, TextField } from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import UploadAvatarButton from "@components/uploadAvatarImageBT";
import { useState } from "react";
import TermCard from "./termCard";

function CreateDeck() {
  const [currentTab, setCurrentTab] = useState({ tab: 0, start: 1 });
  return (
    <div className="create-deck">
      <div className="create-deck__header">
        <h2>Create a new study deck</h2>
        <div
          className="create-btn"
          onClick={() => {
            setCurrentTab((pre) => ({ tab: pre.tab ? 0 : 1, start: 0 }));
          }}
        >
          {currentTab.tab ? "Back" : "Next"}
        </div>
      </div>
      <div
        className="create-deck__tab next"
        tab={currentTab.tab}
        start={currentTab.start}
      >
        <div className="create-deck__info">
          <div className="info-input-card">
            <div className="info-row">
              <TextField
                id="title"
                label="Title"
                variant="standard"
                fullWidth
              />
            </div>
            <div className="info-row">
              <TextField
                id="description"
                label="Description"
                variant="standard"
                fullWidth
                multiline
                rows={3}
              />
            </div>
          </div>
          <div className="info-visible-card">
            <div className="visible-select">
              <FormControl sx={{ m: 1, minWidth: 180 }}>
                <Select
                  value={1}
                  //   onChange={handleChange}
                  displayEmpty
                  inputProps={{ "aria-label": "Without label" }}
                >
                  <MenuItem value={0}>Only me</MenuItem>
                  <MenuItem value={1}>Everyone</MenuItem>
                  <MenuItem value={2}>People with passcode</MenuItem>
                </Select>
                <FormHelperText>Who can view</FormHelperText>
              </FormControl>
            </div>
            <div className="visible-select">
              <FormControl sx={{ m: 1, minWidth: 180 }}>
                <Select
                  value={0}
                  //   onChange={handleChange}
                  displayEmpty
                  inputProps={{ "aria-label": "Without label" }}
                >
                  <MenuItem value={0}>Only me</MenuItem>
                  <MenuItem value={1}>Everyone</MenuItem>
                  <MenuItem value={2}>People with passcode</MenuItem>
                </Select>
                <FormHelperText>Who can edit</FormHelperText>
              </FormControl>
            </div>
          </div>
        </div>
        <br />
        <br />
        <br />
        <UploadAvatarButton />
        <div className="create-deck__term"></div>
      </div>
      <div className="create-deck__tab back" tab={currentTab.tab}>
        <TermCard index={1} />
        <TermCard index={2} />
        <TermCard index={3} />
      </div>
    </div>
  );
}

export default CreateDeck;
