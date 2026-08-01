import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CRM data...');

  console.log('Clearing existing data across all tables...');
  await prisma.assignment.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.contact.deleteMany({});
  await prisma.company.deleteMany({});
  await prisma.user.deleteMany({});

  const usersData = [
    { name: 'SYSTEM ADMIN', email: 'admin@crm.com', role: Role.SYSTEM_ADMIN },
    { name: 'Tony Stark', email: 'tony.stark@avengers.com', role: Role.TECH_SPECIALIST },
    { name: 'Steve Rogers', email: 'steve.rogers@avengers.com', role: Role.SUPREME_COMMANDER },
    { name: 'Natasha Romanoff', email: 'natasha.romanoff@avengers.com', role: Role.STRATEGIC_TACTICIAN },
    { name: 'Thor Odinson', email: 'thor.odinson@avengers.com', role: Role.GUARDIAN_DEFENDER },
    { name: 'Bruce Banner', email: 'bruce.banner@avengers.com', role: Role.TECH_SPECIALIST },
    { name: 'Peter Parker', email: 'peter.parker@avengers.com', role: Role.FIELD_AGENT },
    { name: 'Wanda Maximoff', email: 'wanda.maximoff@avengers.com', role: Role.AVENGER_LEAD },
    { name: 'Stephen Strange', email: 'stephen.strange@avengers.com', role: Role.AVENGER_LEAD },
    { name: 'T\'Challa', email: 'tchalla@avengers.com', role: Role.SUPREME_COMMANDER },
    { name: 'Carol Danvers', email: 'carol.danvers@avengers.com', role: Role.GUARDIAN_DEFENDER },
  ];

  const createdUsers: Record<string, any> = {};
  for (const user of usersData) {
    const u = await prisma.user.create({ data: user });
    createdUsers[user.email] = u;
  }
  console.log(`Successfully seeded ${Object.keys(createdUsers).length} users.`);

  // 1. Create Sample Companies
  const starkInd = await prisma.company.create({
    data: {
      name: 'Stark Industries',
      industry: 'Defense & Clean Energy',
      website: 'https://starkindustries.com',
    },
  });

  const avengersHQ = await prisma.company.create({
    data: {
      name: 'Avengers Compound',
      industry: 'Global Security & Operations',
      website: 'https://avengers.org',
    },
  });

  const wakandaTech = await prisma.company.create({
    data: {
      name: 'Wakanda Design Group',
      industry: 'Vibranium Research & Advanced Tech',
      website: 'https://wakanda.tech',
    },
  });

  console.log('Companies created: Stark Industries, Avengers Compound, Wakanda Design Group.');

  // 2. Create Sample Contacts
  const pepper = await prisma.contact.create({
    data: {
      name: 'Pepper Potts',
      email: 'pepper.potts@stark.com',
      phone: '+1 555-0101',
      companyId: starkInd.id,
    },
  });

  const happy = await prisma.contact.create({
    data: {
      name: 'Happy Hogan',
      email: 'happy.hogan@stark.com',
      phone: '+1 555-0102',
      companyId: starkInd.id,
    },
  });

  const nickFury = await prisma.contact.create({
    data: {
      name: 'Nick Fury',
      email: 'nick.fury@shield.gov',
      phone: '+1 555-0199',
      companyId: avengersHQ.id,
    },
  });

  const shuri = await prisma.contact.create({
    data: {
      name: 'Princess Shuri',
      email: 'shuri@wakanda.gov',
      phone: '+250 555-0188',
      companyId: wakandaTech.id,
    },
  });

  console.log('Contacts created: Pepper Potts, Happy Hogan, Nick Fury, Princess Shuri.');

  // 3. Create Sample Assignments
  const tony = createdUsers['tony.stark@avengers.com'];
  const steve = createdUsers['steve.rogers@avengers.com'];
  const natasha = createdUsers['natasha.romanoff@avengers.com'];
  const peter = createdUsers['peter.parker@avengers.com'];
  const tchalla = createdUsers['tchalla@avengers.com'];
  const admin = createdUsers['admin@crm.com'];

  await prisma.assignment.createMany({
    data: [
      { userId: tony.id, companyId: starkInd.id, role: 'STARK_TECH_ADVISOR' },
      { userId: steve.id, companyId: avengersHQ.id, role: 'FIELD_LEAD' },
      { userId: peter.id, contactId: happy.id, role: 'FIELD_LEAD' },
      { userId: natasha.id, companyId: avengersHQ.id, role: 'SHIELD_DIRECTOR' },
      { userId: natasha.id, contactId: nickFury.id, role: 'HEAD_TACTICIAN' },
      { userId: tchalla.id, companyId: wakandaTech.id, role: 'VIBRANIUM_SPECIALIST' },
      { userId: tchalla.id, contactId: shuri.id, role: 'VIBRANIUM_SPECIALIST' },
      { userId: admin.id, companyId: starkInd.id, role: 'SHIELD_DIRECTOR' },
    ],
  });

  console.log('Assignments created across companies and contacts.');

  // 4. Create Sample Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        title: 'System Initialized',
        message: 'Welcome to the CRM system. All Marvel superhero accounts are now active.',
        type: 'SYSTEM',
        isRead: false,
      },
      {
        userId: tony.id,
        title: 'New Account Assignment',
        message: 'You have been assigned as Account Owner for Stark Industries.',
        type: 'ASSIGNMENT',
        isRead: false,
      },
      {
        userId: peter.id,
        title: 'Support Lead Assignment',
        message: 'You were assigned as Support Lead for contact Happy Hogan.',
        type: 'ASSIGNMENT',
        isRead: false,
      },
      {
        userId: natasha.id,
        title: 'Follow-up Reminder',
        message: 'Scheduled reminder: Follow up with Nick Fury regarding quarterly ops.',
        type: 'CRON_REMINDER',
        isRead: false,
      },
      {
        userId: tchalla.id,
        title: 'New Account Assignment',
        message: 'You have been assigned as Account Owner for Wakanda Design Group.',
        type: 'ASSIGNMENT',
        isRead: true,
      },
    ],
  });

  console.log('Initial notifications seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
