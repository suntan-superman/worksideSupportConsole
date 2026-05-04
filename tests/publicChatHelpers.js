export async function openPublicChat(page) {
  const candidates = [
    page.locator('[data-testid="chat-open-button"]').first(),
    page.getByRole("button", { name: /open merxus chat/i }).first(),
    page.getByRole("button", { name: /open.*chat/i }).first(),
    page.getByRole("button", { name: /chat/i }).first(),
  ];

  for (const candidate of candidates) {
    try {
      if ((await candidate.count()) > 0 && (await candidate.isVisible())) {
        await candidate.click();
        return true;
      }
    } catch {
      // Try the next locator; public launcher markup may vary by deployment.
    }
  }

  return false;
}

export function publicChatInput(page) {
  return page.getByRole("textbox", { name: /type your message/i }).first();
}

export function publicLeadNameInput(page) {
  return page.getByRole("textbox", { name: /^name$/i }).first();
}

export function publicLeadEmailInput(page) {
  return page.getByRole("textbox", { name: /^email$/i }).first();
}

export function talkToPersonButton(page) {
  return page.getByRole("button", { name: /talk to a person/i }).first();
}

export function publicHumanRequestStatus(page) {
  return page.getByText(/notifying|may be offline|team/i).first();
}
