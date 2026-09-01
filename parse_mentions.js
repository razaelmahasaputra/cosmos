function extractMentions(text) {
    const mentions = [];
    const matches = text.match(/@\d+/g);
    if (matches) {
        for (const match of matches) {
            mentions.push(match.substring(1) + '@s.whatsapp.net'); // or @lid?
        }
    }
    return mentions;
}
console.log(extractMentions('Hello @49890910535790 and @62812345678'));
