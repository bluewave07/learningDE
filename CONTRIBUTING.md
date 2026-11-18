# Contributing

Thanks for helping improve learningDE! Most contributions are content: new words, better example sentences, corrections.

## Content guidelines

- **Level:** B2. Example sentences should be natural, everyday German – the kind of sentence you would actually hear at work, at the Bürgeramt or among friends. Aim for 6–14 words.
- **Nouns** always start with the article and show the plural: `das Gerät, -e`, `der Laptop, -s`, `die Kosten (Pl.)`.
- **Verbs** with a fixed preposition or case show it: `sich kümmern um`, `jdm. zustimmen`, `etw. beheben`.
- **The example sentence should contain the headword** (any inflected form). The app highlights it and uses it for cloze questions.
- **English** is required for every word and sentence.
- **Turkish** is optional and only for complex words – bureaucratic or legal terms, idioms, long compounds. Leave it as `""` for simple words.
- **No duplicates.** If a word already exists in another theme, use a different word. Genuine homonyms with a different meaning (e.g. *das Gericht* = court / dish) are fine.

## File formats

**Theme** (`data/NN-name.js`):

```js
(window.THEMES = window.THEMES || []).push({
  id: "unique-id", g: "gen" /* or "it" */, t: "German title", te: "English title",
  w: [ ["der Begriff, -e", "term", "", "Beispielsatz mit dem Begriff.", "Example sentence with the term."] ],
  r: { t: "Text title", te: "English", s: [["Satz.", "Sentence."]], q: [["Frage?", "Question?", ["A", "B", "C"], 1]] },  // optional
  d: { t: "Dialogue title", te: "English", l: [["Name", "Satz.", "Sentence."]], q: [...] }                          // optional
});
```

Question format: `[question DE, question EN, options[], index of the correct option]`.

**Conversation** (`data/conversations.js`): lines whose speaker is `"Sie"` are spoken by the learner in role-play mode.

## Before you open a pull request

```bash
npm install
npm run validate
npx playwright install chromium
npm test
```

Keep pull requests focused – one theme or one feature per PR makes review easier.
