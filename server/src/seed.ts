import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface EmailDef {
  sequenceOrder: number;
  delayDays: number;
  subject: string;
  body: string;
}
interface SeriesDef {
  seriesId: string;
  seriesName: string;
  industry: string;
  tone: string;
  emails: EmailDef[];
}

const SERIES: SeriesDef[] = [
  // ─── RESTAURANTS ────────────────────────────────────────────────────────────
  {
    seriesId: 'restaurant-1',
    seriesName: 'No Website — You\'re Invisible Online',
    industry: 'Restaurants',
    tone: 'professional',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'Quick question about {{business_name}}\'s online presence',
        body: `Hi {{owner_name}},\n\nI came across {{business_name}} on Google Maps and noticed you don't have a website yet. In {{location}}, that means customers searching for restaurants nearby are finding your competitors first.\n\nI specialize in building websites for restaurants — fast, mobile-friendly, and built to show off your menu and bring in reservations. Here's a live example I built for a similar spot: {{demo_link}}\n\nWould a 10-minute call this week work to see if I can do the same for {{business_name}}?\n\nBest,\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — still a few spots left this month',
        body: `Hi {{owner_name}},\n\nCircling back on my note from a few days ago. I've been working with a couple of restaurants in {{location}} this month and have one spot left.\n\nYou can see the kind of work I do here: {{demo_link}}\n\nEven if you're not ready to commit, happy to hop on a quick call and answer any questions.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'One last idea for {{business_name}}',
        body: `Hi {{owner_name}},\n\nI'll keep this short — a restaurant website doesn't need to be complicated. Menu, hours, location, and a way to book. That's it.\n\nHere's what it looks like in practice: {{demo_link}}\n\nMost of my clients are up and running in about a week. If you'd like to move forward or just have questions, I'm easy to reach.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: '{{business_name}} — final note from me',
        body: `Hi {{owner_name}},\n\nI won't reach out again after this — just wanted to leave the door open in case timing wasn't right earlier.\n\nWhen you're ready to get {{business_name}} online, I'm here: {{demo_link}}\n\nWishing you a great week,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'restaurant-2',
    seriesName: 'Turn Your Reviews Into Reservations',
    industry: 'Restaurants',
    tone: 'friendly',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: '{{business_name}} has great reviews — are they driving more customers?',
        body: `Hi {{owner_name}},\n\nI noticed {{business_name}} has solid Google reviews — that's genuinely hard to earn in the restaurant business. The problem is, most people who see those reviews won't take the next step if there's no website to send them to.\n\nI build restaurant websites that turn Google traffic into actual customers. Check out an example here: {{demo_link}}\n\nWould love to show you what I'd do specifically for {{business_name}}. Got 10 minutes this week?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: those reviews for {{business_name}}',
        body: `Hi {{owner_name}},\n\nFollowing up on my last message! Your reputation on Google is an asset — a website would help you get more out of it.\n\nHere's a restaurant site I built recently: {{demo_link}}\n\nHappy to give you a quick walkthrough of what I'd build for {{business_name}}. Just reply and we'll find a time.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'A thought about {{business_name}}\'s growth',
        body: `Hi {{owner_name}},\n\nYou're already doing the hard part — great food, happy customers, good reviews. A website just makes sure the right people can find you.\n\nThis is the kind of site that would work well for {{business_name}}: {{demo_link}}\n\nIf you're interested, I can have something live within a week.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last message — {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my last follow-up — just wanted to make sure this didn't get buried.\n\nIf you ever decide to build a site for {{business_name}}, I'd love to help: {{demo_link}}\n\nNo pressure, just leaving the door open.\n\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'restaurant-3',
    seriesName: 'Your Competitors Are Stealing Your Customers',
    industry: 'Restaurants',
    tone: 'bold',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'The restaurant down the street from {{business_name}} is getting your customers',
        body: `Hi {{owner_name}},\n\nDirect question: how many customers are choosing a competitor tonight because {{business_name}} doesn't show up online with a website?\n\nI build websites for restaurants that flip that equation. Here's a recent example: {{demo_link}}\n\nMobile-friendly, loads fast, shows your menu and hours — everything customers need to choose you. Can we jump on a 10-minute call this week?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — still thinking about my offer?',
        body: `Hi {{owner_name}},\n\nFollowing up quickly. The restaurants winning online in {{location}} aren't necessarily better than {{business_name}} — they just show up when people search.\n\nHere's what I built for a similar spot: {{demo_link}}\n\nWould love to give {{business_name}} the same edge. Quick call this week?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'Last chance this month — {{business_name}}',
        body: `Hi {{owner_name}},\n\nI only take on a few clients per month to make sure every site gets proper attention. I have one spot left and wanted to offer it to {{business_name}} first.\n\nSee the kind of work I do: {{demo_link}}\n\nIf you'd like to talk, just reply. Otherwise, totally understand.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: '{{business_name}} — signing off',
        body: `Hi {{owner_name}},\n\nLast note from me. If things change and you want to get {{business_name}} online, I'm here: {{demo_link}}\n\nTake care and good luck with the restaurant.\n\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'restaurant-4',
    seriesName: 'Show Customers Your Food Before They Visit',
    industry: 'Restaurants',
    tone: 'casual',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'People are searching for your menu before they even leave home',
        body: `Hey {{owner_name}},\n\nQuick thought — 70% of diners check a restaurant's website before deciding where to eat. If {{business_name}} doesn't have one, you're likely losing those people to spots that do.\n\nI build clean, simple restaurant websites with online menus, hours, and map links. Here's an example: {{demo_link}}\n\nWould it be worth a quick chat to see if it makes sense for {{business_name}}?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Still thinking about it? ({{business_name}})',
        body: `Hey {{owner_name}},\n\nFollowing up on my note. I know running a restaurant means a hundred things are fighting for your attention — but getting a site set up is a one-time thing that works for you 24/7.\n\nExample here: {{demo_link}}\n\nHappy to handle all of it. You'd just need to answer a few questions. Sound good?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'What a simple website could do for {{business_name}}',
        body: `Hey {{owner_name}},\n\nYou don't need anything fancy. Just: menu, hours, location, and photos. That's all most diners are looking for before they choose where to eat.\n\nHere's what that looks like: {{demo_link}}\n\nLet me know if you want to get something like this going for {{business_name}}.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last message from me — {{business_name}}',
        body: `Hey {{owner_name}},\n\nNot going to keep bugging you after this! If you ever want to get {{business_name}} online, just shoot me a message.\n\n{{demo_link}} — there's always an example here if you want to see what's possible.\n\nCheers,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'restaurant-5',
    seriesName: 'I Built a Custom Demo for Your Restaurant',
    industry: 'Restaurants',
    tone: 'friendly',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'I built something for {{business_name}}',
        body: `Hi {{owner_name}},\n\nI'm a web designer who works specifically with restaurants in {{location}}, and I put together a concept site that could work for {{business_name}}. Want to take a look?\n\n{{demo_link}}\n\nIt's not live yet — this is just a demo to show you what I have in mind. If you like it and want to move forward, I can have the real version up in about a week.\n\nWould you be open to a quick call to talk it through?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: the site I built for {{business_name}}',
        body: `Hi {{owner_name}},\n\nJust wanted to make sure my last email didn't get buried. I put together a restaurant website concept you might find interesting: {{demo_link}}\n\nFigured it'd be easier to show you what's possible than just describe it. Let me know what you think!\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: '{{business_name}} — still happy to walk you through it',
        body: `Hi {{owner_name}},\n\nOne more nudge and then I'll leave you alone, I promise!\n\nHere's the demo site I put together: {{demo_link}}\n\nIf you like the direction, I can customize it fully for {{business_name}} — your menu, your branding, your photos. Takes about a week from start to finish.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Closing the loop on {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my last note! The demo I built is still there if you want to check it out anytime: {{demo_link}}\n\nFeel free to reach back out whenever the timing works.\n\nWishing you a great season,\n{{sender_name}}`,
      },
    ],
  },

  // ─── GYMS / FITNESS ─────────────────────────────────────────────────────────
  {
    seriesId: 'gym-1',
    seriesName: 'New Members Are Googling You Right Now',
    industry: 'Gyms & Fitness',
    tone: 'professional',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: '{{business_name}} isn\'t showing up when people search for gyms in {{location}}',
        body: `Hi {{owner_name}},\n\nI searched for gyms in {{location}} and noticed {{business_name}} doesn't have a website. People who are ready to sign up for a membership right now can't find you — they're going to whoever does show up.\n\nI build websites for fitness businesses that turn searches into new members. Here's an example: {{demo_link}}\n\nWould a 10-minute call work this week to see if I can help {{business_name}} do the same?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — a quick follow-up',
        body: `Hi {{owner_name}},\n\nCircling back on my note from a few days ago. A gym website doesn't need to be complicated — membership info, class schedule, pricing, and a contact form is all you need to start converting searchers into members.\n\nHere's an example: {{demo_link}}\n\nHappy to chat if you have questions. Just reply!\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'One more thought for {{business_name}}',
        body: `Hi {{owner_name}},\n\nI'll keep this short — most of my gym clients get their first inquiry from the website within the first week of going live.\n\nHere's what I'd build for {{business_name}}: {{demo_link}}\n\nLet me know if you'd like to explore it.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Closing the loop — {{business_name}}',
        body: `Hi {{owner_name}},\n\nLast message from me. Whenever you're ready to get {{business_name}} online, I'm here: {{demo_link}}\n\nWishing you continued success,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'gym-2',
    seriesName: 'Your Competition Is Signing Members Up Online',
    industry: 'Gyms & Fitness',
    tone: 'bold',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'Your competitors are signing up members while {{business_name}} isn\'t online',
        body: `Hi {{owner_name}},\n\nHere's the reality — people searching for gyms in {{location}} right now are choosing whichever gym has the best web presence, not necessarily the best gym. {{business_name}} is losing those sign-ups to places with functioning websites.\n\nI help gyms fix this fast. Check out an example: {{demo_link}}\n\nCan we talk this week? 10 minutes is all it takes.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — still interested?',
        body: `Hi {{owner_name}},\n\nFollowing up on my last email. The fitness market in {{location}} is competitive, and a solid website is one of the most cost-effective ways to stand out.\n\nHere's what I built for a similar gym: {{demo_link}}\n\nWould love to build something like this for {{business_name}}. When's a good time to connect?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: '{{business_name}} — one more thing worth considering',
        body: `Hi {{owner_name}},\n\nMost gyms I work with recoup the cost of a website from a single new member sign-up. It's probably the best ROI of any marketing investment you can make.\n\nHere's an example of the kind of site I build: {{demo_link}}\n\nHappy to give you a quote with no commitment. Just reply!\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last note — {{business_name}}',
        body: `Hi {{owner_name}},\n\nI won't follow up after this. If you ever decide you want to get {{business_name}} set up online, here's a look at what I do: {{demo_link}}\n\nTake care and keep crushing it,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'gym-3',
    seriesName: 'Turn Google Reviews Into Gym Memberships',
    industry: 'Gyms & Fitness',
    tone: 'professional',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'Are your Google reviews converting into new {{business_name}} members?',
        body: `Hi {{owner_name}},\n\nI came across {{business_name}} on Google and noticed your reviews are solid — that's impressive. The challenge is that reviews alone rarely get people to commit to a gym membership. A website that shows pricing, classes, and what members love about you does that job much better.\n\nHere's an example of what I mean: {{demo_link}}\n\nWould a short call this week make sense to see if I can help?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — just a quick thought',
        body: `Hi {{owner_name}},\n\nHi again! I wanted to share that the gym sites I build typically include membership sign-up info, class schedules, trainer bios, and a contact form — everything someone needs to decide "yes, I'm joining."\n\nHere's a recent example: {{demo_link}}\n\nLet me know if this is something worth exploring for {{business_name}}.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'Quick question about {{business_name}}',
        body: `Hi {{owner_name}},\n\nQuick one: how are people who find {{business_name}} on Google getting in touch with you? If it's just a phone number on Google Maps, a lot of potential members are probably not following through.\n\nA website with a simple contact form or membership inquiry form changes that significantly. Here's an example: {{demo_link}}\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Final message — {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my last follow-up! Just leaving a link here in case you ever want to circle back: {{demo_link}}\n\nBest of luck with {{business_name}},\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'gym-4',
    seriesName: 'A Website That Sells Memberships 24/7',
    industry: 'Gyms & Fitness',
    tone: 'casual',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'Hey — people want to sign up for {{business_name}} online. Can they?',
        body: `Hey {{owner_name}},\n\nQuick question — if someone decided right now they wanted to join {{business_name}}, could they find everything they need online? Pricing, membership options, schedule, and a way to sign up or contact you?\n\nIf not, you're probably losing a few sign-ups every week to gyms that make that easy.\n\nHere's an example of what a simple gym website looks like: {{demo_link}}\n\nWorth a quick chat?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Still thinking about it? ({{business_name}})',
        body: `Hey {{owner_name}},\n\nNo pressure, just wanted to follow up. A gym website can be pretty simple — membership tiers, a class schedule, and a contact form. That's all you really need.\n\nHere's an example: {{demo_link}}\n\nI can usually have something live in under a week. Let me know if you're interested!\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'One last thing for {{business_name}}',
        body: `Hey {{owner_name}},\n\nI'll wrap up after this one. A lot of gym owners I work with tell me they wish they'd gotten a website earlier — it's one of those things that just works quietly in the background bringing in new members.\n\n{{demo_link}} — here's what yours could look like.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Okay, last message I promise — {{business_name}}',
        body: `Hey {{owner_name}},\n\nReaching out one final time! If you ever want help getting {{business_name}} online, I'm easy to find.\n\n{{demo_link}}\n\nTake care and keep those members happy,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'gym-5',
    seriesName: 'I Built a Custom Demo for Your Gym',
    industry: 'Gyms & Fitness',
    tone: 'friendly',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'I put together a website concept for {{business_name}}',
        body: `Hi {{owner_name}},\n\nI design websites for gyms and fitness studios in {{location}}, and I put together a demo that shows what I'd build for {{business_name}}. Thought it might be more useful than just describing it.\n\nTake a look: {{demo_link}}\n\nIf you like the direction, we can talk about making it real — with your branding, class schedule, and membership info. Usually takes about a week.\n\nWould a quick call work?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: the {{business_name}} website concept',
        body: `Hi {{owner_name}},\n\nJust checking in on the demo I shared. Here it is again in case it got buried: {{demo_link}}\n\nHappy to walk through it with you on a quick call if that's easier. Just let me know!\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: '{{business_name}} — still love to build this for you',
        body: `Hi {{owner_name}},\n\nI know things get busy! Still happy to build out a proper site for {{business_name}} whenever the timing works.\n\nDemo is still here: {{demo_link}}\n\nOne more follow-up after this and then I'll give you some space. ;)\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last one — {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my last note! The demo is always here if you want to revisit: {{demo_link}}\n\nFeel free to reach out whenever you're ready.\n\nAll the best,\n{{sender_name}}`,
      },
    ],
  },

  // ─── SALONS / BARBERSHOPS ────────────────────────────────────────────────────
  {
    seriesId: 'salon-1',
    seriesName: 'Clients Are Booking Your Competitors Online',
    industry: 'Salons & Barbershops',
    tone: 'friendly',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'Clients are booking {{business_name}}\'s competitors online — are you letting them?',
        body: `Hi {{owner_name}},\n\nI came across {{business_name}} in {{location}} and noticed you don't have a website where clients can book appointments. In today's market, most people book online — if you don't offer that, they find someone who does.\n\nI build websites for salons and barbershops with online booking, service menus, and photo galleries. Here's an example: {{demo_link}}\n\nWould a quick 10-minute call this week be worth it to see if I can help?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — thought you\'d want to see this',
        body: `Hi {{owner_name}},\n\nFollowing up on my last message. I know how busy things get in a salon — but setting up online booking is one of those things that saves time in the long run (no more phone tag with clients!).\n\nHere's an example of what the booking flow looks like: {{demo_link}}\n\nHappy to chat if you have questions!\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'A quick thought about {{business_name}}',
        body: `Hi {{owner_name}},\n\nHere's what most of my salon clients tell me after going live: "I can't believe how many bookings started coming in automatically."\n\nHere's an example of what I'd build for {{business_name}}: {{demo_link}}\n\nIf this sounds good, I'd love to help. Just reply!\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last message from me — {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my last follow-up, I promise! If you ever decide to get {{business_name}} online with a booking system, I'm here: {{demo_link}}\n\nWishing you a full schedule,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'salon-2',
    seriesName: 'Instagram Is Not a Website',
    industry: 'Salons & Barbershops',
    tone: 'casual',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'Instagram is great, but it\'s not a website — {{business_name}}',
        body: `Hey {{owner_name}},\n\nI love seeing salons with great Instagram pages — but here's the thing: Instagram doesn't tell Google you exist. People searching "best salon in {{location}}" aren't finding you there.\n\nA simple website with your services, prices, and a booking link is what gets you found in searches. Here's an example of what I mean: {{demo_link}}\n\nWorth a quick chat?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: getting {{business_name}} on Google search',
        body: `Hey {{owner_name}},\n\nFollowing up quickly! Your Instagram content could be pulling double duty if you had a website too — Google can't index Instagram posts, but it loves website content.\n\nHere's an example site: {{demo_link}}\n\nHappy to explain how it works if you're curious. Just reply!\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'One more thing for {{business_name}}',
        body: `Hey {{owner_name}},\n\nLast nudge on this one! A website for {{business_name}} would: show up in Google searches, let clients book without calling, and display your work to new potential clients.\n\nHere's what it looks like: {{demo_link}}\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Signing off — {{business_name}}',
        body: `Hey {{owner_name}},\n\nOkay, last message from me! If you ever want to get {{business_name}} on Google's radar, you know where to find me.\n\n{{demo_link}}\n\nKeep creating great work,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'salon-3',
    seriesName: 'Your Best Work Deserves a Better Showcase',
    industry: 'Salons & Barbershops',
    tone: 'professional',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: '{{business_name}}\'s best work deserves a better showcase',
        body: `Hi {{owner_name}},\n\nI saw {{business_name}} on Google and was curious — where do your best clients refer new customers? Word of mouth is powerful, but new people searching online are looking for a website with photos, prices, and a way to book.\n\nI build websites for salons that show off portfolios, services, and pricing professionally. Here's an example: {{demo_link}}\n\nWould a quick call make sense to explore this for {{business_name}}?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — I think this would suit you well',
        body: `Hi {{owner_name}},\n\nFollowing up on my last note. A great portfolio website for {{business_name}} would let your work speak for itself — even before a client walks in the door.\n\nHere's a recent example of the kind of site I build for salons: {{demo_link}}\n\nJust reply if you'd like to talk it through!\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'Still thinking about it — {{business_name}}',
        body: `Hi {{owner_name}},\n\nOne more thought: a website that showcases your best work and makes booking easy pays for itself quickly. Most of my salon clients see a return within the first month.\n\nHere's that example again: {{demo_link}}\n\nLet me know if you have questions.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last note — {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my final follow-up! The offer stands — whenever you're ready to give {{business_name}} the online presence it deserves, I'm here.\n\n{{demo_link}}\n\nBest of luck,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'salon-4',
    seriesName: 'You\'re Leaving Revenue on the Table',
    industry: 'Salons & Barbershops',
    tone: 'bold',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: '{{business_name}} is leaving money on the table',
        body: `Hi {{owner_name}},\n\nIf {{business_name}} doesn't have a website with an online booking system, you're losing potential clients every day — people who searched, found nothing, and booked somewhere else.\n\nI build salon websites that fill your calendar. Here's a live example: {{demo_link}}\n\n10 minutes on a call could change how {{business_name}} grows this year. Interested?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — still a real opportunity here',
        body: `Hi {{owner_name}},\n\nFollowing up! Think about it this way: if a website brought you just 2 new clients per month, it would likely pay for itself in the first month.\n\nHere's what I'd build for {{business_name}}: {{demo_link}}\n\nWant to talk numbers? Happy to give you a breakdown.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'Your last chance to get ahead of the competition — {{business_name}}',
        body: `Hi {{owner_name}},\n\nOther salons in {{location}} are already investing in their online presence. The window to stand out is still open, but it won't be forever.\n\nHere's an example of the kind of site I build: {{demo_link}}\n\nLet me know if you want to get ahead of this.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Alright, last one — {{business_name}}',
        body: `Hi {{owner_name}},\n\nI'll leave you with this: {{demo_link}}\n\nIf the time ever comes that you want to invest in growing {{business_name}} online, I'm just a message away.\n\nBest,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'salon-5',
    seriesName: 'I Built a Custom Demo for Your Salon',
    industry: 'Salons & Barbershops',
    tone: 'friendly',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'I made a website demo for {{business_name}}',
        body: `Hi {{owner_name}},\n\nI'm a web designer who specializes in salons and barbershops, and I put together a demo website concept for {{business_name}}. Figured showing is better than telling.\n\nHave a look: {{demo_link}}\n\nIf you like it, I can build out the full version with your branding, service menu, and booking system in about a week. Would you be open to a quick call?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: the {{business_name}} website concept',
        body: `Hi {{owner_name}},\n\nFollowing up on the demo I sent over! Here's the link again just in case: {{demo_link}}\n\nHappy to do a quick walkthrough on a call if that's easier for you. Just let me know what works!\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: '{{business_name}} — still here if you want it',
        body: `Hi {{owner_name}},\n\nStill happy to build this out for {{business_name}} whenever you're ready. It's a pretty low-lift process on your end — I handle everything, you just give feedback.\n\nDemo: {{demo_link}}\n\nOne more follow-up after this and then I'll leave you alone. :)\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Okay, this is really the last one — {{business_name}}',
        body: `Hi {{owner_name}},\n\nTruly my last message! If you ever want to revisit this, the demo is always here: {{demo_link}}\n\nTake care and keep styling,\n{{sender_name}}`,
      },
    ],
  },

  // ─── DENTAL OFFICES ──────────────────────────────────────────────────────────
  {
    seriesId: 'dental-1',
    seriesName: 'New Patients Are Searching for You Right Now',
    industry: 'Dental Offices',
    tone: 'professional',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'New patients in {{location}} are looking for a dentist — can they find {{business_name}}?',
        body: `Hi {{owner_name}},\n\nEvery day, people in {{location}} search for a new dentist. If {{business_name}} doesn't have a professional website, those patients are going to practices that do.\n\nI build websites for dental offices that establish credibility, showcase services, and make it easy for patients to book. Here's an example: {{demo_link}}\n\nWould a 10-minute call this week be worthwhile?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — a few more details',
        body: `Hi {{owner_name}},\n\nFollowing up on my last note. The dental websites I build typically include: services list, team bios, insurance info, patient forms, and an online booking option. Everything a new patient needs to feel confident booking with you.\n\nHere's an example: {{demo_link}}\n\nHappy to chat whenever works for you.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'One more thought for {{business_name}}',
        body: `Hi {{owner_name}},\n\nHere's something worth considering: most patients say they research a dentist online before calling. Your website is their first impression.\n\nHere's what I'd build for {{business_name}}: {{demo_link}}\n\nI'd love to help you make a great first impression.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Final note — {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my last message. If you ever decide {{business_name}} needs a stronger online presence, I'm here to help: {{demo_link}}\n\nWishing you a full appointment book,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'dental-2',
    seriesName: 'Patients Google You Before They Call',
    industry: 'Dental Offices',
    tone: 'professional',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'Does {{business_name}}\'s online presence match the quality of your care?',
        body: `Hi {{owner_name}},\n\nI found {{business_name}} on Google while researching dental practices in {{location}}. Your reviews suggest you provide excellent care — but I noticed your online presence doesn't fully reflect that.\n\nPatients decide who to trust before they ever walk in the door. A professional website makes that decision easy for them. Here's an example of the kind of work I do: {{demo_link}}\n\nWould a brief call to discuss what I could build for {{business_name}} be worthwhile?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — still thinking it over?',
        body: `Hi {{owner_name}},\n\nJust following up on my previous message. I understand you're busy — managing a dental practice is no small thing.\n\nHere's the example I mentioned: {{demo_link}}\n\nEven 10 minutes on a call could clarify whether this is worth pursuing. Happy to work around your schedule.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'A note about patient acquisition for {{business_name}}',
        body: `Hi {{owner_name}},\n\nNew patients typically choose a dentist based on: proximity, reviews, and website professionalism. If one of those three is missing, they move on.\n\nHere's what a professional dental website looks like: {{demo_link}}\n\nI'd be glad to help {{business_name}} tick all three boxes.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last message from me — {{business_name}}',
        body: `Hi {{owner_name}},\n\nI'll leave this here as a resource: {{demo_link}}\n\nWhenever {{business_name}} is ready for a website that matches the quality of your practice, I'd be honored to build it.\n\nBest regards,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'dental-3',
    seriesName: 'Can Patients Book With You Online?',
    industry: 'Dental Offices',
    tone: 'casual',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'Can patients book with {{business_name}} online?',
        body: `Hey {{owner_name}},\n\nQuick question — do you have online booking for {{business_name}}? Most patients (especially younger ones) won't call to make an appointment. They just move on to the next practice.\n\nI build dental websites with integrated booking, service pages, and insurance info. Here's an example: {{demo_link}}\n\nWorth a quick chat?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: online booking for {{business_name}}',
        body: `Hey {{owner_name}},\n\nFollowing up! Adding online booking to your practice doesn't have to be complicated. I handle all of it — you just answer a few questions and I build the whole thing.\n\nExample site: {{demo_link}}\n\nHappy to hop on a quick call if you want to see how it works.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'Still happy to help — {{business_name}}',
        body: `Hey {{owner_name}},\n\nLast push from me on this! A dental website with online booking, services, and team info doesn't just look good — it actively fills your schedule.\n\nHere's an example: {{demo_link}}\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Okay, last one — {{business_name}}',
        body: `Hey {{owner_name}},\n\nThis is truly my last follow-up. If you ever want to get {{business_name}} set up with online booking and a proper website, I'm here: {{demo_link}}\n\nTake care,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'dental-4',
    seriesName: 'Your Competitors Are Ranking Above You on Google',
    industry: 'Dental Offices',
    tone: 'bold',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'Other dentists in {{location}} are ranking above {{business_name}} on Google',
        body: `Hi {{owner_name}},\n\nWhen someone searches "dentist in {{location}}," the top results go to practices with strong websites. If {{business_name}} isn't there, those patients are going to your competitors.\n\nI build dental websites that are designed to rank well and convert new patients. Here's an example: {{demo_link}}\n\nI'd love to help {{business_name}} show up where it should. Can we talk this week?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — the SEO angle',
        body: `Hi {{owner_name}},\n\nFollowing up! A dental website isn't just about looking good — it's about showing up in searches. The practices ranking at the top of Google in {{location}} have professional websites with the right structure.\n\nHere's what that looks like in practice: {{demo_link}}\n\nHappy to chat about what this could mean for {{business_name}}.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'One more opportunity for {{business_name}}',
        body: `Hi {{owner_name}},\n\nSearches for dentists in {{location}} happen hundreds of times a month. Right now, those searches are turning into appointments at other practices.\n\nHere's what a website that captures those patients looks like: {{demo_link}}\n\nIf this is something you'd like to address, I have availability this month.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Final note — {{business_name}}',
        body: `Hi {{owner_name}},\n\nLast message from me. Leaving this here in case you circle back to this conversation later: {{demo_link}}\n\nBest of luck growing the practice,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'dental-5',
    seriesName: 'I Built a Custom Demo for Your Practice',
    industry: 'Dental Offices',
    tone: 'professional',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'I put together a website concept for {{business_name}}',
        body: `Hi {{owner_name}},\n\nI'm a web designer who works with dental practices in {{location}}, and I took the time to put together a site concept for {{business_name}}. I find it's better to show than tell.\n\nHere it is: {{demo_link}}\n\nIf you like the direction, I can build the full version with your team info, services, insurance accepted, and online booking. The process usually takes about a week.\n\nWould you be open to a brief call?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: the {{business_name}} website concept',
        body: `Hi {{owner_name}},\n\nJust making sure this didn't get lost in your inbox. Here's the concept I built for {{business_name}}: {{demo_link}}\n\nHappy to walk through it on a quick call. I know your time is valuable — I'll keep it under 10 minutes.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: '{{business_name}} — still available to build this',
        body: `Hi {{owner_name}},\n\nStill happy to build this out for {{business_name}} whenever the timing is right. The demo gives you a good sense of the direction: {{demo_link}}\n\nOne more follow-up after this, then I'll let you be!\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last message — {{business_name}}',
        body: `Hi {{owner_name}},\n\nMy final message! If you'd ever like to revisit this, the demo is here: {{demo_link}}\n\nThank you for your time, and best of luck with the practice.\n\nWarm regards,\n{{sender_name}}`,
      },
    ],
  },

  // ─── CONTRACTORS / HOME SERVICES ─────────────────────────────────────────────
  {
    seriesId: 'contractor-1',
    seriesName: 'Homeowners Can\'t Find You Without a Website',
    industry: 'Contractors & Home Services',
    tone: 'professional',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'Homeowners in {{location}} can\'t find {{business_name}} online',
        body: `Hi {{owner_name}},\n\nI was looking for contractors in {{location}} and noticed {{business_name}} doesn't have a website. Every week, homeowners search for your services online and go with whoever they can actually find and vet.\n\nI build websites for contractors and home service companies that generate inbound calls. Here's an example: {{demo_link}}\n\nWould a quick 10-minute call be worth your time this week?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — a few more thoughts',
        body: `Hi {{owner_name}},\n\nFollowing up on my last message. A contractor website should do a few key things: show past work, list services, provide a quote request form, and have your phone number prominently displayed. That's really all it takes to turn searches into calls.\n\nHere's an example: {{demo_link}}\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'One more thought for {{business_name}}',
        body: `Hi {{owner_name}},\n\nI'll be direct — contractors without websites are losing jobs to ones with them, even when the work quality is better. It's just how homeowners search now.\n\nHere's what I'd build for {{business_name}}: {{demo_link}}\n\nHappy to chat if this is something you want to fix.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last note — {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my final follow-up. Whenever you're ready to get {{business_name}} online, I'm here: {{demo_link}}\n\nWishing you a full job queue,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'contractor-2',
    seriesName: 'Your Best Work Deserves to Be Seen',
    industry: 'Contractors & Home Services',
    tone: 'friendly',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: '{{business_name}}\'s reviews are solid — are they working hard enough for you?',
        body: `Hi {{owner_name}},\n\nI came across {{business_name}} on Google and noticed you have some really solid reviews — that's not easy to build in the trades. The thing is, those reviews could be driving a lot more work if you had a website for people to land on after seeing them.\n\nI build websites for contractors that turn reviews into real leads. Here's an example: {{demo_link}}\n\nWould a quick chat this week make sense?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — still want to help',
        body: `Hi {{owner_name}},\n\nFollowing up! A good contractor website shows your past work, highlights your reviews, and gives homeowners an easy way to request a quote. It works for you 24/7 while you're on the job.\n\nHere's an example: {{demo_link}}\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'A quick question for {{business_name}}',
        body: `Hi {{owner_name}},\n\nHere's a quick one: when a homeowner searches for your service in {{location}} at 10pm, can they find {{business_name}}, see your work, and request a quote? A website makes all three of those possible around the clock.\n\nHere's an example: {{demo_link}}\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Wrapping up — {{business_name}}',
        body: `Hi {{owner_name}},\n\nLast message! If you ever want to get a website working for {{business_name}}, I'm here: {{demo_link}}\n\nKeep up the great work out there,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'contractor-3',
    seriesName: 'Stop Losing Jobs to Less Qualified Competitors',
    industry: 'Contractors & Home Services',
    tone: 'bold',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'Less qualified contractors are getting the calls that should go to {{business_name}}',
        body: `Hi {{owner_name}},\n\nHere's a frustrating truth about the trades market in {{location}}: homeowners can't tell who's more qualified based on a Google listing alone. They go with whoever has the most professional-looking website.\n\nI help contractors like you level the playing field — and win. Here's an example: {{demo_link}}\n\nCan we talk this week?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — still interested?',
        body: `Hi {{owner_name}},\n\nFollowing up on my last message. The contractors winning the most jobs online right now aren't always the best — they're just the most visible. I help {{business_name}} become both.\n\nHere's an example of the kind of site I build: {{demo_link}}\n\nJust reply if you'd like to chat.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: '{{business_name}} — a real competitive edge',
        body: `Hi {{owner_name}},\n\nA professional website with photo galleries of your work, a clear service list, and a quote form is the highest-ROI marketing tool a contractor can have. It pays for itself from a single job.\n\nHere's an example: {{demo_link}}\n\nIf you're interested, I have capacity this month.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last note — {{business_name}}',
        body: `Hi {{owner_name}},\n\nSigning off after this one! If you want to get ahead of your competition online, I'm here: {{demo_link}}\n\nGood luck out there,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'contractor-4',
    seriesName: 'A Website That Gets You More Calls',
    industry: 'Contractors & Home Services',
    tone: 'professional',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'Is {{business_name}} getting online quote requests?',
        body: `Hi {{owner_name}},\n\nI specialize in building websites for contractors that generate quote requests directly from the site. Homeowners today prefer to browse, see examples of your work, and submit a request — without having to call first.\n\nHere's an example of what that looks like: {{demo_link}}\n\nIf {{business_name}} isn't getting inbound quote requests online, I'd love to change that. Can we talk?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — online leads for contractors',
        body: `Hi {{owner_name}},\n\nFollowing up! The contractors I build websites for typically start seeing online quote requests within the first few weeks of going live. The key is making the request form easy to find and the work examples compelling.\n\nHere's a live example: {{demo_link}}\n\nHappy to walk you through it. Just reply!\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'One more thought about {{business_name}}\'s leads',
        body: `Hi {{owner_name}},\n\nIf you rely entirely on word-of-mouth for new business, you're leaving yourself vulnerable to slow seasons. A website that generates consistent online leads smooths that out significantly.\n\nHere's an example of what I build: {{demo_link}}\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Final message — {{business_name}}',
        body: `Hi {{owner_name}},\n\nLast note from me. Whenever you're ready to add online lead generation to {{business_name}}'s toolbox, I'm here: {{demo_link}}\n\nBest,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'contractor-5',
    seriesName: 'I Built a Custom Demo for Your Business',
    industry: 'Contractors & Home Services',
    tone: 'friendly',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'I put together a website concept for {{business_name}}',
        body: `Hi {{owner_name}},\n\nI design websites for contractors in {{location}} and put together a demo concept for {{business_name}}. Figured showing you is worth more than describing it.\n\nCheck it out: {{demo_link}}\n\nIf you like the direction, I can build the full version with your services, past project photos, license info, and a quote form. Usually done in about a week.\n\nInterested in a quick call?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: the {{business_name}} website concept',
        body: `Hi {{owner_name}},\n\nJust following up on the demo I sent. Here it is again: {{demo_link}}\n\nI know the timing might not always be right — but if you have 10 minutes, I'd love to walk through it with you.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: '{{business_name}} — still here to build this',
        body: `Hi {{owner_name}},\n\nStill happy to build this out for {{business_name}} when the timing works. The demo gives you a sense of the look and feel: {{demo_link}}\n\nOne more follow-up after this and I'll leave you to it.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last one — {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my last message! The demo is always there if you want to come back to it later: {{demo_link}}\n\nThanks for your time, and keep doing great work,\n{{sender_name}}`,
      },
    ],
  },

  // ─── REAL ESTATE AGENTS ───────────────────────────────────────────────────────
  {
    seriesId: 'realtor-1',
    seriesName: 'Your Listings Deserve a Better Platform',
    industry: 'Real Estate Agents',
    tone: 'professional',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'Your listings deserve a better platform than Zillow alone',
        body: `Hi {{owner_name}},\n\nI came across your listings for {{business_name}} in {{location}} and wanted to share a thought — relying solely on third-party listing platforms means you're driving traffic to their site, not yours. A personal website lets you own that relationship.\n\nI build websites for real estate agents that showcase listings, build personal brand, and generate direct leads. Here's an example: {{demo_link}}\n\nWould a brief call this week make sense?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — your personal real estate site',
        body: `Hi {{owner_name}},\n\nFollowing up on my last message. A personal real estate website gives you: a central hub for all your listings, your bio and track record, client testimonials, and a direct way for buyers and sellers to contact you.\n\nHere's an example: {{demo_link}}\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'One more idea for {{business_name}}',
        body: `Hi {{owner_name}},\n\nIn real estate, your personal brand IS your business. A professional website reinforces that brand every time someone Googles you — which buyers and sellers absolutely do.\n\nHere's what I'd build for you: {{demo_link}}\n\nHappy to chat if this resonates.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last message — {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my final follow-up. If you ever want to strengthen your online presence, I'm here: {{demo_link}}\n\nBest of luck with your listings,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'realtor-2',
    seriesName: 'Buyers Google You Before They Call',
    industry: 'Real Estate Agents',
    tone: 'professional',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'Buyers and sellers Google you before they call — what do they find?',
        body: `Hi {{owner_name}},\n\nThe first thing most buyers or sellers do after getting a referral is Google the agent's name. If {{business_name}} doesn't have a professional website, that Google search might send them to someone else.\n\nI build real estate agent websites that build instant trust and generate inquiries. Here's an example: {{demo_link}}\n\nWould a quick call be worthwhile to explore this?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: your online presence — {{business_name}}',
        body: `Hi {{owner_name}},\n\nFollowing up! The agents I build for typically include: professional headshots, transaction history, neighborhood expertise, testimonials, and a contact form. It's the online equivalent of a strong referral.\n\nHere's an example: {{demo_link}}\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'A real estate website that works for you 24/7',
        body: `Hi {{owner_name}},\n\nOne of the advantages of a personal website is that it works while you're busy closing deals. Buyers browsing at midnight can learn about you, see your listings, and send you a message.\n\nHere's what that looks like: {{demo_link}}\n\nHappy to discuss this for {{business_name}}.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Final note — {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my last follow-up. Whenever you're ready to invest in your personal brand online, I'd love to help: {{demo_link}}\n\nBest regards,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'realtor-3',
    seriesName: 'Your Personal Brand Is Your Business',
    industry: 'Real Estate Agents',
    tone: 'casual',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: '{{owner_name}}, your real estate brand needs its own home online',
        body: `Hey {{owner_name}},\n\nIn real estate, your name is your business. But if someone searches "{{owner_name}} realtor {{location}}," do they find a strong, professional website — or nothing at all?\n\nI build personal websites for agents that showcase your personality, track record, and listings in one place. Here's an example: {{demo_link}}\n\nWant to chat about getting yours set up?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: your personal real estate site',
        body: `Hey {{owner_name}},\n\nFollowing up quickly! I know you've got a lot going on — but a personal website is one of those assets that quietly builds your brand even while you're showing homes.\n\nHere's an example: {{demo_link}}\n\nHappy to chat whenever works for you.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'Still thinking about it? — {{owner_name}}',
        body: `Hey {{owner_name}},\n\nOne last push! The agents who have their own websites in {{location}} have a real edge in lead generation. I'd love to help you get one.\n\nDemo: {{demo_link}}\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last message from me — {{owner_name}}',
        body: `Hey {{owner_name}},\n\nOkay, truly the last one! If you ever want to get your personal real estate brand a proper online home, I'm here: {{demo_link}}\n\nTake care and close big,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'realtor-4',
    seriesName: 'More Leads From Your Local Market',
    industry: 'Real Estate Agents',
    tone: 'bold',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'Are you leaving real estate leads on the table, {{owner_name}}?',
        body: `Hi {{owner_name}},\n\nEvery month, buyers and sellers in {{location}} search for local agents online. Without a professional website, {{business_name}} isn't part of that conversation.\n\nI build agent websites designed to generate leads — not just look good. Here's an example: {{demo_link}}\n\nCould 10 minutes this week change how many leads you get this year? I think so. Want to find out?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — the lead generation angle',
        body: `Hi {{owner_name}},\n\nFollowing up! A website with a clear CTA, neighborhood content, and an easy contact form is one of the most effective lead gen tools an agent can have. It works independent of referrals or cold calls.\n\nHere's an example: {{demo_link}}\n\nHappy to show you what I'd build for you specifically.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: '{{business_name}} — one more thought on growth',
        body: `Hi {{owner_name}},\n\nThe top-producing agents in most markets have one thing in common: a strong personal website. It's the hub that all their other marketing points back to.\n\nHere's an example: {{demo_link}}\n\nIf you're serious about growing your business this year, let's talk.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Signing off — {{business_name}}',
        body: `Hi {{owner_name}},\n\nLast message from me. Whenever you're ready to invest in a website that brings you leads, here's what I can do: {{demo_link}}\n\nBest of luck out there,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'realtor-5',
    seriesName: 'I Built a Custom Demo for Your Agency',
    industry: 'Real Estate Agents',
    tone: 'professional',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'I built a website concept for {{business_name}}',
        body: `Hi {{owner_name}},\n\nI specialize in building personal websites for real estate agents in {{location}}, and I put together a concept specifically for {{business_name}}. I think you'll find it easier to evaluate if you can actually see it.\n\nHere it is: {{demo_link}}\n\nIf it's heading in the right direction, I can build the full version with your listings, bio, testimonials, and contact system. Typically takes about a week.\n\nWould you be open to a brief call?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: the {{business_name}} website concept',
        body: `Hi {{owner_name}},\n\nJust following up on the concept I shared. Here's the link in case it got buried: {{demo_link}}\n\nI'd love to walk through it with you — even 10 minutes is enough to know if it's a fit.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: '{{business_name}} — I\'m still here to make this happen',
        body: `Hi {{owner_name}},\n\nStill happy to build out a full website for {{business_name}} whenever you're ready. The concept gives you a sense of the style and structure: {{demo_link}}\n\nLast follow-up after this!\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Final note — {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my last message. If you'd like to revisit the concept at any point, it's here: {{demo_link}}\n\nThank you for considering me, and best of luck with your business.\n\nSincerely,\n{{sender_name}}`,
      },
    ],
  },

  // ─── AUTO REPAIR SHOPS ────────────────────────────────────────────────────────
  {
    seriesId: 'auto-1',
    seriesName: 'Car Owners Are Searching for Shops Right Now',
    industry: 'Auto Repair Shops',
    tone: 'professional',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: '{{business_name}} doesn\'t show up when people search for auto repair in {{location}}',
        body: `Hi {{owner_name}},\n\nI searched for auto repair shops in {{location}} and noticed {{business_name}} doesn't have a website. When someone's car breaks down and they need a shop fast, they go with whatever comes up online — and right now, that's not {{business_name}}.\n\nI build websites for auto shops that get you found and get your phone ringing. Here's an example: {{demo_link}}\n\nWould a 10-minute call this week be worthwhile?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — a quick follow-up',
        body: `Hi {{owner_name}},\n\nFollowing up on my last message! An auto shop website should do three things: show your services and pricing, make it easy to call or request an appointment, and showcase what makes you trustworthy. I build all of that.\n\nExample: {{demo_link}}\n\nHappy to chat whenever works.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'One more thought for {{business_name}}',
        body: `Hi {{owner_name}},\n\nHere's the thing — when someone's car needs work, they search online first. If you're not there, you're not in the running. A simple, fast-loading website changes that.\n\nHere's what I'd build: {{demo_link}}\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last note — {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my final message. Whenever {{business_name}} is ready to get found online, I'm here: {{demo_link}}\n\nWishing you a full bay every day,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'auto-2',
    seriesName: 'Your Google Rating Isn\'t Driving Enough Customers',
    industry: 'Auto Repair Shops',
    tone: 'friendly',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: '{{business_name}}\'s reviews are strong — is your website living up to them?',
        body: `Hi {{owner_name}},\n\nI noticed {{business_name}} has solid Google reviews — in the auto repair industry, that kind of trust is really hard to build. The issue is that a lot of potential customers see those reviews but then can't find a website to confirm you're legit.\n\nI build auto shop websites that turn reviews into booked appointments. Here's an example: {{demo_link}}\n\nWould a quick call make sense?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — building on your reputation',
        body: `Hi {{owner_name}},\n\nFollowing up! The best auto shop sites I build feature: service menu with pricing, customer reviews front and center, certifications and specialties, and an easy appointment request form.\n\nHere's an example: {{demo_link}}\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'A thought about {{business_name}}\'s online reputation',
        body: `Hi {{owner_name}},\n\nYour existing reviews tell a story — a website tells the rest of it. People want to see what you work on, how you price things, and whether you stand behind your work.\n\nHere's an example of what I'd build: {{demo_link}}\n\nHappy to help if you're interested!\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last message — {{business_name}}',
        body: `Hi {{owner_name}},\n\nLast one from me! Whenever you're ready to build on that great reputation online, I'm here: {{demo_link}}\n\nKeep up the excellent work,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'auto-3',
    seriesName: 'The Shop Down the Street Has a Website — You Don\'t',
    industry: 'Auto Repair Shops',
    tone: 'bold',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'The shop down the street from {{business_name}} has a website — you don\'t',
        body: `Hi {{owner_name}},\n\nWhen someone searches "auto repair near me" in {{location}}, they're comparing shops based on what they see online. If {{business_name}} doesn't have a website, you've already lost that comparison — even if your work is better.\n\nI build auto shop websites that win that comparison. Here's an example: {{demo_link}}\n\nCan we talk this week?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — still thinking about it?',
        body: `Hi {{owner_name}},\n\nFollowing up! Competitors with websites are getting calls from people who would be great {{business_name}} customers. A website flips that around.\n\nHere's an example of the kind of site I build: {{demo_link}}\n\nJust reply and we'll find a time to chat.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: '{{business_name}} — one last push',
        body: `Hi {{owner_name}},\n\nI'll be straight with you: a well-built auto shop website typically pays for itself from a single new customer. The ROI is hard to argue with.\n\nHere's an example: {{demo_link}}\n\nIf you're open to it, I have a spot available this month.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Final note — {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my last message! Leaving this here for whenever you're ready: {{demo_link}}\n\nTake care,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'auto-4',
    seriesName: 'Build Trust Before Customers Even Call',
    industry: 'Auto Repair Shops',
    tone: 'professional',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'People trust auto shops more when they can research them first',
        body: `Hi {{owner_name}},\n\nAuto repair is one of those industries where trust is everything — and increasingly, customers build that trust by researching a shop online before they ever call. Without a website, {{business_name}} is invisible to those customers.\n\nI build auto shop websites that establish trust before the first phone call. Here's an example: {{demo_link}}\n\nWould a brief call make sense to explore this?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: {{business_name}} — building customer trust online',
        body: `Hi {{owner_name}},\n\nFollowing up! The most effective elements of an auto shop website for building trust: certifications, specialties listed, customer reviews, and a "meet the team" section.\n\nHere's an example: {{demo_link}}\n\nHappy to discuss what would work best for {{business_name}}.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: 'One more thought about {{business_name}}',
        body: `Hi {{owner_name}},\n\nA website doesn't just get you found — it gets customers to choose you. The difference between a shop with a trustworthy-looking website and one without is often the deciding factor.\n\nHere's an example: {{demo_link}}\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Signing off — {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my last message. Whenever {{business_name}} is ready to build its online presence, I'd be glad to help: {{demo_link}}\n\nBest regards,\n{{sender_name}}`,
      },
    ],
  },
  {
    seriesId: 'auto-5',
    seriesName: 'I Designed a Sample Site for Auto Shops',
    industry: 'Auto Repair Shops',
    tone: 'friendly',
    emails: [
      {
        sequenceOrder: 1, delayDays: 0,
        subject: 'I put together a website concept for {{business_name}}',
        body: `Hi {{owner_name}},\n\nI build websites for auto repair shops in {{location}} and put together a demo concept for {{business_name}}. Thought you'd rather see it than read about it.\n\nHere's the demo: {{demo_link}}\n\nIf you like the direction, I can build the full version with your services, pricing, team info, and an appointment request form. Usually takes about a week.\n\nWould you be open to a quick call to talk it through?\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 2, delayDays: 3,
        subject: 'Re: the {{business_name}} website concept',
        body: `Hi {{owner_name}},\n\nFollowing up on the concept I sent over! Here it is again: {{demo_link}}\n\nHappy to hop on a quick call if you'd like a walkthrough. I'll keep it to 10 minutes.\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 3, delayDays: 6,
        subject: '{{business_name}} — still here to build this',
        body: `Hi {{owner_name}},\n\nStill happy to make this a reality for {{business_name}} whenever the timing works. The demo gives a good sense of what the final site would look like: {{demo_link}}\n\nOne more message after this and then I'll let you be!\n\n{{sender_name}}`,
      },
      {
        sequenceOrder: 4, delayDays: 9,
        subject: 'Last message — {{business_name}}',
        body: `Hi {{owner_name}},\n\nThis is my very last follow-up. If you ever want to revisit this, the demo is always here: {{demo_link}}\n\nThanks for your time and best of luck with the shop,\n{{sender_name}}`,
      },
    ],
  },
];

async function main() {
  console.log('Seeding prebuilt email templates...');

  await prisma.prebuiltTemplate.deleteMany({});

  let count = 0;
  for (const series of SERIES) {
    for (const email of series.emails) {
      await prisma.prebuiltTemplate.create({
        data: {
          industry: series.industry,
          seriesId: series.seriesId,
          seriesName: series.seriesName,
          sequenceOrder: email.sequenceOrder,
          delayDays: email.delayDays,
          subject: email.subject,
          body: email.body,
          tone: series.tone,
        },
      });
      count++;
    }
  }

  console.log(`✓ Seeded ${count} prebuilt templates across ${SERIES.length} series`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
