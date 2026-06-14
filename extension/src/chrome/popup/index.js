import { useEffect, useState } from "react";
import styled from "styled-components";
import { speak } from "../../api-service/voiceService";
import EditableInput from "./editableInput";

const primaryColor = "#4255ff";
const primaryHoverColor = "#658EFF";

const ScrollableContainer = styled.div`
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  box-sizing: border-box;
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;

const PopupContainer = styled.div`
  position: absolute;
  left: ${(props) => props.left + 10}px;
  top: ${(props) => props.top + 20}px;
  background-color: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
  z-index: 2147483647;
  width: 300px;
  height: 400px;
  overflow: hidden;
  box-sizing: border-box !important;
  animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes popIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
`;

const TopPopup = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const CloseButton = styled.button`
  height: 24px;
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 11px;
  color: #94a3b8;
  background-color: #f1f5f9;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    background-color: #e2e8f0;
    color: #475569;
  }
`;

const TermHeaderContainer = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  color: ${primaryColor};
  margin-top: 8px;
  margin-bottom: 12px;
`;

const TermSpeaker = styled.button`
  background: #eff6ff;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  transition: all 0.2s;
  flex-shrink: 0;

  & > img {
    height: 16px;
    width: 16px;
    filter: invert(28%) sepia(99%) saturate(4552%) hue-rotate(237deg)
      brightness(102%) contrast(86%);
  }

  &:hover {
    background-color: #dbeafe;
    transform: scale(1.05);
  }
  &:active {
    transform: scale(0.95);
  }
`;

const TermHeader = styled.h2`
  margin: 0 !important;
  padding: 0 !important;
  font-size: 1.25rem !important;
  line-height: 1.6rem !important;
  font-weight: 700 !important;
  color: #1e293b !important;
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const MeaningContainer = styled.div`
  padding: 12px 14px;
  background-color: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-bottom: 16px;

  & > p:first-of-type {
    margin: 0 0 6px 0 !important;
    font-size: 0.75rem !important;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  & > img {
    display: block;
    margin: 12px auto !important;
    width: 40px !important;
    height: 40px !important;
  }

  & > div.error-text {
    font-weight: 500;
    font-size: 0.85rem !important;
    color: #ef4444 !important;
    margin-top: 4px;
  }
`;

const LinkGroup = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  margin-top: -6px;
`;

const ResourceLink = styled.a`
  font-size: 0.75rem !important;
  font-weight: 600;
  color: #475569 !important;
  background-color: #f1f5f9;
  padding: 4px 10px;
  border-radius: 12px;
  text-decoration: none !important;
  display: inline-flex;
  align-items: center;
  transition: all 0.2s;

  &:hover {
    background-color: #e2e8f0;
    color: #1e293b !important;
    transform: translateY(-0.5px);
  }
`;

const ImageGallery = styled.div`
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
  max-height: 360px;
  overflow-y: auto;
`;

const ImageThumbnail = styled.img`
  box-sizing: border-box !important;
  width: 100%;
  height: 110px;
  object-fit: cover;
  cursor: pointer;
  border-radius: 8px;
  border: 2px solid transparent;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  transition: all 0.2s;

  border-color: ${(props) => (props.selected ? primaryColor : "transparent")};
  box-shadow: ${(props) => (props.selected ? "0 4px 12px rgba(66, 85, 255, 0.15)" : "0 2px 4px rgba(0,0,0,0.04)")};

  &:hover {
    border-color: ${primaryColor};
    transform: scale(1.02);
  }
`;

const AddToDeckButton = styled.button`
  background-color: ${primaryColor};
  color: white;
  border: none;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.85rem !important;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  margin-top: 12px;
  box-shadow: 0 4px 12px rgba(66, 85, 255, 0.15);
  transition: all 0.2s;

  &:hover {
    background-color: ${primaryHoverColor};
    box-shadow: 0 6px 16px rgba(66, 85, 255, 0.25);
  }
  &:active {
    transform: scale(0.98);
  }
`;

const LoadingIcon = styled.img`
  animation: spin 1s linear infinite;

  @keyframes spin {
    100% {
      transform: rotate(360deg);
    }
  }
`;

const AiButton = styled.button`
  background-color: #ffffff;
  color: ${primaryColor};
  border: 1px solid ${primaryColor};
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.8rem !important;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  margin-top: 8px;
  transition: all 0.2s;

  &:hover {
    background-color: #eef1ff;
  }
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

const AiSection = styled.div`
  margin-bottom: 12px;

  & label {
    display: block;
    font-size: 0.7rem !important;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 8px 0 2px;
  }

  & input,
  & textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 0.8rem !important;
    color: #1e293b;
    resize: vertical;
  }
`;

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background-color: ${(props) => (props.muted ? "#f1f5f9" : "#eef1ff")};
  color: ${(props) => (props.muted ? "#475569" : primaryColor)};
  border: 1px solid ${(props) => (props.muted ? "#e2e8f0" : "#d6dbff")};
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 0.75rem !important;
  font-weight: 600;

  & > button {
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    opacity: 0.6;
    font-size: 0.85rem !important;
    line-height: 1;
    padding: 0;

    &:hover {
      opacity: 1;
    }
  }
`;

const ExampleList = styled.ul`
  margin: 4px 0 0 !important;
  padding-left: 16px !important;
  list-style: disc;

  & > li {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 6px;
    font-size: 0.8rem !important;
    line-height: 1.45;
    color: #334155;

    & > span {
      flex: 1;
    }

    & > button {
      flex-shrink: 0;
      background: none;
      border: none;
      cursor: pointer;
      color: #cbd5e1;
      font-size: 0.9rem !important;
      line-height: 1;
      padding: 0;

      &:hover {
        color: #ef4444;
      }
    }
  }
`;

const AddRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
`;

const AddInput = styled.input`
  flex: 1;
  min-width: 0;
`;

const AddButton = styled.button`
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background-color: #eef1ff;
  color: ${primaryColor};
  font-size: 1rem !important;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #e0e5ff;
  }
`;

/*global chrome*/
const speakerURL = chrome.runtime.getURL("images/speaker.png");
const notFoundURL = chrome.runtime.getURL("images/notfound.jpg");
const loadingURL = chrome.runtime.getURL("images/loading.png");

function sendMessageToBackgroundScript(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, function (response) {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

const SetupDeckHint = styled.p`
  margin: 8px 0 0 !important;
  font-size: 0.8rem !important;
  color: #64748b !important;
  line-height: 1.4;
`;

export default function TranslationPopup({
  term,
  request,
  left,
  top,
  onClose,
  hasDefaultDeck = true,
}) {
  const popupTop =
    top + 400 > window.innerHeight + window.scrollY ? top - 400 : top;
  const popupLeft = left + 300 > window.innerWidth ? left - 300 : left;

  const [isLoading, setIsLoading] = useState(true);
  const [meaning, setMeaning] = useState("");
  const [images, setImages] = useState([]);
  const [error, setError] = useState(null);
  const [selectedImg, setselectedImg] = useState();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);
  const [aiFields, setAiFields] = useState(null);
  const [newSynonym, setNewSynonym] = useState("");
  const [newAntonym, setNewAntonym] = useState("");
  const [newExample, setNewExample] = useState("");

  const setAiField = (key) => (e) =>
    setAiFields((prev) => ({ ...prev, [key]: e.target.value }));

  const addAiListItem = (key, rawValue, reset) => {
    const value = (rawValue || "").trim();
    if (!value) return;
    setAiFields((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), value],
    }));
    reset("");
  };

  const removeAiListItem = (key, idx) =>
    setAiFields((prev) => ({
      ...prev,
      [key]: (prev[key] || []).filter((_, i) => i !== idx),
    }));

  const handleFillWithAi = async () => {
    setAiLoading(true);
    setError(null);
    try {
      const res = await request.post("terms/ai_enrich/", {
        name: term,
        meaning,
      });
      if (res.error) {
        setError(res.error.errors || "AI request failed.");
      } else {
        const d = res.data || {};
        setAiFields({
          word_type: d.word_type || "",
          pronunciation: d.pronunciation || "",
          definition: d.definition || "",
          synonyms: d.synonyms || [],
          antonyms: d.antonyms || [],
          examples: d.examples || [],
        });
        setAiFilled(true);
      }
    } catch (err) {
      setError("AI request failed. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const encodedPhrase = encodeURIComponent(term);
  const definitionPhrase = encodeURIComponent(term + " definition");
  const youglish = "https://youglish.com/pronounce/" + encodedPhrase + "/english";
  const google = "https://www.google.com/search?q=" + definitionPhrase;

  const handleAddToDefaultDeck = async () => {
    try {
      const payload = {
        image: selectedImg,
        name: term,
        meaning,
      };
      if (aiFields) {
        payload.word_type = aiFields.word_type;
        payload.pronunciation = aiFields.pronunciation;
        payload.definition = aiFields.definition;
        payload.synonyms = aiFields.synonyms || [];
        payload.antonyms = aiFields.antonyms || [];
        payload.examples = aiFields.examples || [];
        payload.ai_filled = true;
      }
      const res = await request.post("terms/add_to_default_deck/", payload);
      if (!res.error) onClose();
      else setError(res.error.errors);
    } catch (err) {
      if (err.response?.data?.errors) {
        setError(err.response.data.errors);
      } else {
        console.log(err);
        setError("Failed to add term. Please try again.");
      }
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
  };

  const handleSpeak = () => {
    speak(term);
  };

  useEffect(() => {
    setIsLoading(true);
    sendMessageToBackgroundScript({
      action: "translate",
      text: term,
    }).then((response) => {
      if (response.error) {
        setError("Translation failed. Please try again.");
      } else {
        setMeaning(response.translatedText);
      }
      setIsLoading(false);
    });

    sendMessageToBackgroundScript({
      action: "fetch_images",
      query: term,
    })
      .then((response) => {
        if (response.urls) {
          setImages(response.urls);
        }
      })
      .catch((e) => console.log(e));
  }, [term]);

  return (
    <PopupContainer left={popupLeft} top={popupTop} onClick={handleClick}>
      <ScrollableContainer>
        <TopPopup>
          <CloseButton onClick={onClose}>&times;</CloseButton>
        </TopPopup>

        <TermHeaderContainer id="term-header">
          <TermHeader>{term}</TermHeader>
          <TermSpeaker onClick={handleSpeak} title="Pronounce">
            <img src={speakerURL} alt="speak term" />
          </TermSpeaker>
        </TermHeaderContainer>

        <LinkGroup>
          <ResourceLink href={youglish} target="_blank" rel="noreferrer">
            YouGlish
          </ResourceLink>
          <ResourceLink href={google} target="_blank" rel="noreferrer">
            Google
          </ResourceLink>
        </LinkGroup>

        <MeaningContainer>
          <p>Meaning</p>
          {!error && isLoading && (
            <LoadingIcon src={loadingURL} alt="loading icon" />
          )}
          {!error && !isLoading && (
            <EditableInput value={meaning} setValue={setMeaning} />
          )}
          {error && <img src={notFoundURL} alt="notfound icon" />}
          {error && <div className="error-text">{error}</div>}

          {!isLoading && hasDefaultDeck && (
            <AiButton onClick={handleFillWithAi} disabled={aiLoading}>
              {aiLoading
                ? "Generating..."
                : aiFilled
                ? "✨ Regenerate with AI"
                : "✨ Fill with AI"}
            </AiButton>
          )}
          {meaning && !isLoading && hasDefaultDeck && (
            <AddToDeckButton onClick={handleAddToDefaultDeck}>
              + Add to Default Deck
            </AddToDeckButton>
          )}
          {meaning && !isLoading && !hasDefaultDeck && (
            <SetupDeckHint>
              Open the Flashlearn extension popup and choose a default deck to
              save terms.
            </SetupDeckHint>
          )}
        </MeaningContainer>

        {aiFields && (
          <AiSection>
            <label>Type of word</label>
            <input
              value={aiFields.word_type}
              onChange={setAiField("word_type")}
              placeholder="Noun, Verb..."
            />
            <label>Pronunciation</label>
            <input
              value={aiFields.pronunciation}
              onChange={setAiField("pronunciation")}
              placeholder="/ɔɪl/"
            />
            <label>Definition</label>
            <textarea
              rows={2}
              value={aiFields.definition}
              onChange={setAiField("definition")}
            />
            <label>Synonyms</label>
            <ChipRow>
              {(aiFields.synonyms || []).map((s, i) => (
                <Chip key={`syn-${i}`}>
                  {s}
                  <button
                    type="button"
                    onClick={() => removeAiListItem("synonyms", i)}
                  >
                    &times;
                  </button>
                </Chip>
              ))}
            </ChipRow>
            <AddRow>
              <AddInput
                value={newSynonym}
                onChange={(e) => setNewSynonym(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  addAiListItem("synonyms", newSynonym, setNewSynonym)
                }
                placeholder="Add a synonym"
              />
              <AddButton
                type="button"
                onClick={() =>
                  addAiListItem("synonyms", newSynonym, setNewSynonym)
                }
              >
                +
              </AddButton>
            </AddRow>

            <label>Antonyms</label>
            <ChipRow>
              {(aiFields.antonyms || []).map((a, i) => (
                <Chip muted key={`ant-${i}`}>
                  {a}
                  <button
                    type="button"
                    onClick={() => removeAiListItem("antonyms", i)}
                  >
                    &times;
                  </button>
                </Chip>
              ))}
            </ChipRow>
            <AddRow>
              <AddInput
                value={newAntonym}
                onChange={(e) => setNewAntonym(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  addAiListItem("antonyms", newAntonym, setNewAntonym)
                }
                placeholder="Add an antonym"
              />
              <AddButton
                type="button"
                onClick={() =>
                  addAiListItem("antonyms", newAntonym, setNewAntonym)
                }
              >
                +
              </AddButton>
            </AddRow>

            <label>Examples</label>
            <ExampleList>
              {(aiFields.examples || []).map((ex, i) => (
                <li key={`ex-${i}`}>
                  <span>{ex}</span>
                  <button
                    type="button"
                    onClick={() => removeAiListItem("examples", i)}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ExampleList>
            <AddRow>
              <AddInput
                value={newExample}
                onChange={(e) => setNewExample(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  addAiListItem("examples", newExample, setNewExample)
                }
                placeholder="Add an example"
              />
              <AddButton
                type="button"
                onClick={() =>
                  addAiListItem("examples", newExample, setNewExample)
                }
              >
                +
              </AddButton>
            </AddRow>
          </AiSection>
        )}

        <ImageGallery>
          {images.map((i) => (
            <ImageThumbnail
              onClick={() => setselectedImg(i)}
              selected={i === selectedImg}
              key={i}
              src={i}
              alt=""
            />
          ))}
        </ImageGallery>
      </ScrollableContainer>
    </PopupContainer>
  );
}
