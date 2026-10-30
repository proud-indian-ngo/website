---
# The help page for Proud Indian in ChatGPT, Claude and other AI assistants: the documentation and support link in
# both directory listings. Edit the Markdown below; the page at /assistants/ renders it with a table of contents built
# from the ## headings. HTML comments are notes for the team and do not appear on the page.
# Keep it in step with what the dashboard's assistant tools do (docs/architecture/assistants.md in proud-indian-ngo/dash).
title: Proud Indian in ChatGPT and Claude
description: Use Proud Indian in ChatGPT, Claude and other AI assistants to find volunteering sessions in Bengaluru, sign up for one and follow your requests.
# the line about this page in /llms.txt
summary: how to add Proud Indian to ChatGPT, Claude and other AI assistants, what they can do with it (find sessions, sign up, follow requests, find the donation page), and how to get help.
# While true, the page shows the draft note, stays out of search engines (noindex) and out of the sitemap.
draft: false
draftNote: This page is a draft and may change.
dateLabel: Last updated
effectiveDate: "30 October 2026"
lede: >-
  Add Proud Indian to ChatGPT, Claude or another AI assistant, and you can find a volunteering session in Bengaluru,
  sign up for it and follow your requests without leaving the chat.
---

## What you can do

Once you add Proud Indian, your assistant can:

- **tell you about Proud Indian**: what we do, our programmes and how to get involved;
- **list upcoming sessions**: the public volunteering sessions coming up, with dates, places and sign-up links;
- **give you the donation link**: a link to the donation section of our website, where you choose an amount and pay on Razorpay yourself;
- **sign you up for a session**: if you're new, it creates your volunteer account and asks to join the session for you.

If you already have a dashboard account and connect it, your assistant can also:

- **list your session requests**: the sessions you have asked to join;
- **ask to join a session for you**: your team lead then approves it.

Try asking:

- "What volunteering sessions are coming up in Bengaluru?"
- "Sign me up for the Spoken English class on Sunday."
- "Which sessions have I asked to join?"

Volunteers must be 18 or older. Our [terms of use](/terms/) apply when you use Proud Indian in an assistant.

## Adding Proud Indian to your assistant

In ChatGPT, add Proud Indian from its [plugin directory listing](https://chatgpt.com/plugins/plugin_asdk_app_6adef6f22d08819188d20d4fa63e4aec), or search for "Proud Indian" under **Plugins**.

Proud Indian isn't in Claude's Connectors Directory yet. Until it is, or in an assistant without a directory, add it as a custom connector with this address:

`https://dash.proudindian.ngo/api/mcp`

### In ChatGPT

1. Open **Plugins**.
2. Press the **+** button.
3. Choose **Add custom MCP server**, enter the address above and save.

### In Claude

1. Open **Customize**, then **Connectors**.
2. Choose **Add custom connector**.
3. Enter the address above and add it.

If you don't see these options, your plan or workspace may not allow custom connectors. You don't need to sign in to anything to add Proud Indian: you only connect your account later, if you want to.

## Signing up through an assistant

Tell the assistant which session you'd like to join. It asks for your name, email address and phone number, and asks you to confirm that you are 18 or older. Before it sends them, check the details and the session: assistants can make mistakes.

We then email you a link to confirm your address. Open it to confirm. Never read anything from the email back to the assistant.

Once you have confirmed, we send your welcome message and WhatsApp orientation, and the link takes you to the dashboard to set a password. Your team lead then approves your request to join the session.

If you already have an account, the assistant can't sign you up again. Use the session's sign-up link to sign in, or connect your account (below).

Each email address and phone number can be used for three sign-ups a day.

## Connecting your account

Connect your dashboard account to see your session requests and ask to join sessions from the chat.

1. Ask the assistant something that needs your account, such as "Which sessions have I asked to join?", or connect Proud Indian in its settings.
2. The assistant opens our sign-in page at dash.proudindian.ngo. Sign in there as usual. The assistant never sees your password.
3. Approve the connection on the next page.

### Disconnecting

To disconnect, remove or disconnect Proud Indian in your assistant's settings. Any access the assistant still holds then runs out: its access token within an hour, and the refresh token it uses to get new ones within 30 days.

The dashboard has no page to remove a connection yet. To have us remove it straight away, write to connect@proudindian.ngo from the email address of your account. Deleting your account also removes all its connections.

## What the assistant can't do

- **Approve requests.** Team leads approve session requests in the dashboard.
- **Cancel a request.** To withdraw from a session, use the dashboard at dash.proudindian.ngo.
- **Take payments.** It only gives you the link to our donation page. You pay on Razorpay's page yourself, and it never sees your card or UPI details.

Everything else, such as your profile, teams, attendance and notifications, is in the dashboard.

## Your privacy

What you type in the chat goes to OpenAI (for ChatGPT) or Anthropic (for Claude) under their own privacy policies. We never receive your chat history: we only receive what the assistant sends to our tools.

When you sign up, that is your name, email address, phone number, your confirmation that you are 18 or older and the session you chose, and nothing else. When you connect your account, we store the connection and your approval, and only hashed forms of the tokens the assistant uses.

The full details are in our privacy policy, under [If you use Proud Indian in ChatGPT or Claude](/privacy/#if-you-use-proud-indian-in-chatgpt-or-claude).

## Getting help

If something doesn't work, or you have a question about Proud Indian in an assistant:

- email connect@proudindian.ngo;
- call or WhatsApp +91 99864 31321.

Tell us which assistant you used and what you asked, and leave out passwords. We usually reply within a few days.
