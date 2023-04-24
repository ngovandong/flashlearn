import { styled } from "@mui/material/styles";
import InputBase from "@mui/material/InputBase";
import SearchIcon from "@mui/icons-material/Search";
import { COLORS } from "@constants/colors";
import { CircularProgress, List, ListItem, ListItemText } from "@mui/material";
import React, { useEffect, useState } from "react";
import { deckService } from "@api-services/deckService";
import { getFirstError } from "@utils/errorHandler";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";

const Search = styled("div")(({ theme }) => ({
  position: "relative",
  borderRadius: theme.shape.borderRadius,
  backgroundColor: COLORS.APP_BACKGROUND,
  marginLeft: 0,
  marginRight: "2rem",
  width: "100%",
  [theme.breakpoints.up("sm")]: {
    marginLeft: theme.spacing(1),
    width: "auto",
  },
}));

const SearchIconWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: COLORS.MINOR_TEXT,
}));

const StyledInputBase = styled(InputBase)(({ theme, isfocus }) => ({
  color: "inherit",
  "& .MuiInputBase-input": {
    padding: theme.spacing(1, 1, 1, 0),
    // vertical padding + font size from searchIcon
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create("width"),
    width: "100%",
    "::placeholder": {
      color: COLORS.MINOR_TEXT,
    },
    "&:focus": {
      border: `0.5px solid ${COLORS.MINOR_TEXT}`,
      borderRadius: theme.shape.borderRadius,
    },
    [theme.breakpoints.up("sm")]: {
      width: isfocus === "true" ? "28ch" : "18ch",
    },
  },
}));

const ItemContainer = styled(List)({
  backgroundColor: "white",
  boxShadow: "0 0.125rem 0.5rem 0 #30354514",
  borderRadius: "4px",
  padding: "0.5rem",
  position: "absolute",
  top: "46px",
  width: "30ch",
  overflow: "auto",
  maxHeight: "16rem",
  "&::-webkit-scrollbar": {
    width: "0.5rem",
  },
  "&::-webkit-scrollbar-track": {
    backgroundColor: "#f1f1f1",
    borderRadius: "0.5rem",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: "0.5rem",
  },
  "&.loading": {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.8,
    height: "260px",
  },
});

const Item = styled(Link)({
  display: "block",
  padding: ".25rem .5rem",
  textDecoration: "none",
  backgroundColor: "#fff",
  marginTop: "2px",
  marginBottom: "2px",
  borderRadius: "4px",
  "&:hover": {
    backgroundColor: "#f0f0f0",
    cursor: "pointer",
  },
});

const ItemText = styled(ListItemText)({
  color: "#333",
});

function ItemList({ items, loading, setIsFocus }) {
  return (
    <ItemContainer className={`${loading ? "loading" : ""}`}>
      {loading && <CircularProgress color="blue" />}
      {!loading &&
        items.length !== 0 &&
        items.map((item) => (
          <Item
            key={item.id}
            to={`deck/${item.id}`}
            onClick={(e) => {
              setIsFocus(false);
            }}
          >
            <ItemText primary={item.name} />
          </Item>
        ))}
      {!loading && items.length === 0 && <div>0 matching results</div>}
    </ItemContainer>
  );
}
function SearchDeckInput() {
  const [searchValue, setSearchValue] = useState("");
  const [isFocus, setIsFocus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filteredItems, setFilteredItems] = useState([]);

  const handleSearch = async () => {
    try {
      const res = await deckService.searchDeck(searchValue);
      if (!res.error) {
        setFilteredItems(res.data);
      } else {
        const errorMessage = getFirstError(res.error);
        toast.error(errorMessage);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchValue !== "") {
      const debounceTimer = setTimeout(handleSearch, 800); // 800ms delay before calling the filter function

      return () => {
        clearTimeout(debounceTimer);
      };
    }
  }, [searchValue]);

  const handleSearchChange = (event) => {
    setSearchValue(event.target.value);
    if (event.target.value !== "") {
      setLoading(true);
    } else {
      setFilteredItems([]);
      setLoading(false);
    }
  };

  return (
    <>
      <Search
        onBlur={() => {
          setSearchValue("");
          setTimeout(() => setIsFocus(false), 200);
        }}
      >
        <SearchIconWrapper>
          <SearchIcon />
        </SearchIconWrapper>
        <StyledInputBase
          placeholder="Search public deck"
          onChange={handleSearchChange}
          value={searchValue}
          onFocus={() => setIsFocus(true)}
          isfocus={isFocus.toString()}
        />
        {isFocus && (
          <ItemList
            setIsFocus={setIsFocus}
            items={filteredItems}
            loading={loading}
          />
        )}
      </Search>
    </>
  );
}

export default SearchDeckInput;
