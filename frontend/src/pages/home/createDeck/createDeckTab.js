import UploadAvatarButton from "@components/uploadAvatarImageBT";
import {
  FormControl,
  FormHelperText,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";

function CreateDeckTab({ deck, setDeck, handleClickNext }) {
  return (
    <>
      <div className="upper-btns">
        <div></div>
        <div className="main-btn" onClick={handleClickNext}>
          Next
        </div>
      </div>
      <div className="create-deck__info">
        <div className="info-input-card">
          <div className="info-row">
            <TextField
              id="title"
              label="Title"
              variant="standard"
              fullWidth
              value={deck.name}
              onChange={(e) =>
                setDeck((pre) => ({ ...pre, name: e.target.value }))
              }
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
              value={deck.description}
              onChange={(e) =>
                setDeck((pre) => ({ ...pre, description: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="info-visible-card">
          <div className="visible-select">
            <FormControl sx={{ m: 1, minWidth: 180 }}>
              <Select
                value={deck.is_public}
                onChange={(e) =>
                  setDeck((pre) => ({ ...pre, is_public: e.target.value }))
                }
                displayEmpty
                inputProps={{ "aria-label": "Without label" }}
              >
                <MenuItem value={false}>Only me</MenuItem>
                <MenuItem value={true}>Everyone</MenuItem>
              </Select>
              <FormHelperText>Who can view</FormHelperText>
            </FormControl>
          </div>
        </div>
      </div>
      <br />
      <br />
      <br />
      <UploadAvatarButton
        selectedFile={deck.background}
        setSelectedFile={(file) =>
          setDeck((pre) => ({ ...pre, background: file }))
        }
        required={true}
      />
    </>
  );
}

export default CreateDeckTab;
