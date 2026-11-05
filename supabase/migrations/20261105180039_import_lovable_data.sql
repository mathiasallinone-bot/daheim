-- Einmalige Übernahme der Daten aus der Lovable-Version (Stand 05.11.2026).
-- Läuft nur, wenn die Familie noch nicht existiert; mehrfaches Ausführen ist unschädlich.
-- Sterne werden 1:1 übernommen: der Sterne-Trigger ist während des Imports aus.
-- Familienmitglieder werden nicht kopiert (neue Logins): nach dem ersten Anmelden
-- mit dem Einladungscode der Familie beitreten (siehe ANLEITUNG.md).

alter table public.task_completions disable trigger trg_completion_stars;

insert into public.families (id, name, invite_code, created_by, created_at, stars_reset_at) values
  ('780077ac-4783-401c-a257-b1b7833317a2', 'Familie Lüthi', '6a2cea9e0f', '6bcdc0d9-0706-4a67-9dba-2938333ba567',
   '2026-10-25T21:08:39.520029+00:00', '2026-10-30T18:42:14.3325+00:00')
on conflict do nothing;

insert into public.recurring_tasks (id, family_id, title, interval_days, last_done, next_due, created_at) values
  ('487a584d-a642-45b5-8c0f-8759e8e12952', '780077ac-4783-401c-a257-b1b7833317a2', 'Katzentoiletten gründlich reinigen', 28, '2026-10-24', '2026-11-21', '2026-10-25T21:08:39.520029+00:00'),
  ('f35ccd19-9fb4-4410-8ed7-8a6fa1e1ab92', '780077ac-4783-401c-a257-b1b7833317a2', 'Filter des Katzenbrunnens wechseln', 28, '2026-10-15', '2026-11-12', '2026-10-25T21:08:39.520029+00:00')
on conflict do nothing;

insert into public.laundry_requests (id, family_id, day, part, created_by, created_at)
select (e->>0)::uuid, '780077ac-4783-401c-a257-b1b7833317a2', (e->>1)::date, e->>2,
       '6bcdc0d9-0706-4a67-9dba-2938333ba567', (e->>3)::timestamptz
from jsonb_array_elements('[
 ["85ffd83a-443d-4e66-bbc2-5a179010b9a0","2026-10-27","abend","2026-10-28T18:30:35.985078+00:00"],
 ["ee4c89c4-c868-4903-bd40-d3183254cd11","2026-10-30","abend","2026-10-30T06:17:53.130543+00:00"],
 ["6145b489-e8c2-422e-b15c-24df2656778d","2026-11-02","abend","2026-11-02T20:38:33.184716+00:00"]
]'::jsonb) e
on conflict do nothing;

-- [id, Tag, Aufgabe, Sterne, erstellt, selber gemacht]
insert into public.task_completions (id, family_id, day, task_key, stars, completed_by, created_at, self_done)
select (e->>0)::uuid, '780077ac-4783-401c-a257-b1b7833317a2', (e->>1)::date, e->>2, (e->>3)::int,
       '6bcdc0d9-0706-4a67-9dba-2938333ba567', (e->>4)::timestamptz, (e->>5)::boolean
from jsonb_array_elements('[
 ["6c6f4065-c4c2-4c4c-88f6-c5c55a5e6870","2026-10-25","trockenfutter",5,"2026-10-25T21:08:49.578865+00:00",false],
 ["25104b41-31e0-4c77-ab6a-9630b63b3734","2026-10-25","rucksack",2,"2026-10-25T21:08:56.755816+00:00",false],
 ["1bc3d89a-4dfe-4b1f-8b93-921daf10b390","2026-10-25","kleider-bereitlegen",2,"2026-10-25T21:08:57.887945+00:00",false],
 ["a4b1a172-1de0-479d-9056-14305e663306","2026-10-25","haarewaschen",2,"2026-10-25T21:08:59.692916+00:00",false],
 ["d9f88e53-ee60-43a2-8e56-703d44814c05","2026-10-26","zaehne-morgen",0,"2026-10-26T18:52:17.91986+00:00",false],
 ["6cdd919a-9a6a-4a77-93d5-0c3b3cf3a5bc","2026-10-26","trockenfutter",5,"2026-10-26T18:54:46.005369+00:00",false],
 ["7495b003-8375-4d4f-946f-51213e3a29be","2026-10-28","trockenfutter",5,"2026-10-28T18:18:00.245383+00:00",false],
 ["de56e656-35ec-4d51-bfcd-09f8ec9de8d8","2026-10-28","zaehne-morgen",0,"2026-10-28T18:18:05.951444+00:00",false],
 ["9766108f-1304-4a3b-ae29-9263e9bd9e76","2026-10-28","rucksack-auspacken",0,"2026-10-28T18:18:11.350247+00:00",false],
 ["ddaa2855-ecaf-480b-8fbe-5e7527b87f59","2026-10-26","hausaufgaben",0,"2026-10-28T18:28:50.306118+00:00",false],
 ["e920cc18-95f7-428a-8063-3022d6049053","2026-10-26","rucksack-auspacken",0,"2026-10-28T18:29:35.405135+00:00",false],
 ["ed84fbd8-c855-4da3-b4a0-8252c9af2828","2026-10-26","rucksack",0,"2026-10-28T18:29:39.771622+00:00",false],
 ["110c84bb-3d45-4b13-a26d-8a6db0f310bb","2026-10-26","kleider-bereitlegen",0,"2026-10-28T18:29:53.620621+00:00",false],
 ["88116189-9995-4c79-add7-8f9f425fca09","2026-10-26","zaehne-abend",0,"2026-10-28T18:29:55.898228+00:00",false],
 ["d5c053bd-bfee-40c1-85f3-eea14860a0ad","2026-10-27","trockenfutter",5,"2026-10-28T18:30:43.442704+00:00",false],
 ["5d26dcac-05b0-40d0-a14a-d483884b5001","2026-10-27","zaehne-morgen",0,"2026-10-28T18:31:01.236394+00:00",false],
 ["a672e6b0-f481-4654-ba27-1a2a465b73fb","2026-10-27","rucksack-auspacken",0,"2026-10-28T18:31:04.801975+00:00",false],
 ["1c0cd6ec-e6bf-4a42-9d95-0ee5cf135fac","2026-10-27","rucksack",0,"2026-10-28T18:31:10.666023+00:00",false],
 ["81b0539a-ef0a-44c9-b6a0-05d59cd039df","2026-10-27","zaehne-abend",0,"2026-10-28T18:31:18.209991+00:00",false],
 ["4aa22453-75be-40fc-83cb-bac6a522835d","2026-10-27","kleider-bereitlegen",0,"2026-10-28T18:31:25.709316+00:00",false],
 ["cf694088-7a50-48b0-aed6-d39f5a99b3cf","2026-10-27","kleider-zusammenlegen",10,"2026-10-28T18:31:36.593536+00:00",false],
 ["2e6d64ce-c4a9-4d49-a6f3-edfb634bb386","2026-10-28","zaehne-abend",0,"2026-10-28T20:23:45.757538+00:00",false],
 ["44fbf41f-89d2-4008-8741-5e28e824900a","2026-10-28","rucksack",0,"2026-10-28T20:27:38.978408+00:00",false],
 ["7c48cfa3-7f0b-4d6b-b687-a51647581c06","2026-10-28","kleider-bereitlegen",0,"2026-10-28T20:29:27.217813+00:00",false],
 ["4c8d6e04-4282-4f66-9525-406bff910672","2026-10-29","rucksack-auspacken",0,"2026-10-29T18:28:55.62088+00:00",false],
 ["f6517a3a-fc47-46a2-b688-b3f632fe973f","2026-10-29","rucksack",0,"2026-10-29T20:17:52.113043+00:00",false],
 ["fdeb1e90-ce46-42e0-bd88-8fc71db78d4f","2026-10-29","haarewaschen",0,"2026-10-29T20:18:28.645481+00:00",false],
 ["5ce99458-5013-4d5e-a6cc-8dd8f5cc0f8f","2026-10-29","kleider-bereitlegen",0,"2026-10-29T20:26:30.996999+00:00",false],
 ["aa23d7ed-c531-4e1b-a87a-7da4c6e3c063","2026-10-29","haare-abend",0,"2026-10-29T20:27:42.9843+00:00",false],
 ["e0477b78-5222-4e37-a7fc-e88998bd6bf8","2026-10-29","zaehne-abend",0,"2026-10-29T20:33:57.628004+00:00",false],
 ["84f3d0ae-4bdd-4aa0-97ee-e3e3b161eed2","2026-10-29","trockenfutter",5,"2026-10-29T20:40:40.813786+00:00",false],
 ["a788d893-6c1a-4cb3-977c-2957a6b9facf","2026-10-30","kleider-zusammenlegen",10,"2026-10-30T11:17:00.241355+00:00",false],
 ["4109da3b-b0f5-460b-b041-18301e7907a8","2026-10-30","rucksack-auspacken",0,"2026-10-30T12:23:58.310599+00:00",false],
 ["f295a542-840a-489f-b15e-41d75663137f","2026-10-30","buch-lesen",5,"2026-10-30T18:37:36.152257+00:00",false],
 ["6918dade-af61-490f-ad92-4890621e8b6a","2026-10-30","zaehne-abend",0,"2026-10-30T21:20:21.800187+00:00",false],
 ["83852730-279e-445d-b4be-de890e0b2478","2026-10-30","tagesabschluss",0,"2026-10-30T21:34:24.508724+00:00",false],
 ["f52b6980-f87f-488a-8dec-daa7707f6f3e","2026-10-30","abfall",1,"2026-10-31T10:14:13.291964+00:00",false],
 ["b93fbea7-229f-494a-a8b5-a222bd92714a","2026-10-30","haare-abend",0,"2026-10-31T10:16:08.825998+00:00",false],
 ["6a61b89b-3b50-45bb-9f28-f29f084e2c75","2026-10-31","zaehne-morgen",0,"2026-10-31T20:02:02.448761+00:00",false],
 ["353e3420-d3e9-4de3-acf6-fab101127aa8","2026-10-31","haare-morgen",0,"2026-10-31T20:02:10.770932+00:00",false],
 ["4f01a245-49e7-4dff-9392-fd574a1aa058","2026-10-31","zaehne-abend",0,"2026-10-31T21:50:07.146432+00:00",false],
 ["e7fc28a0-4861-4231-9c5f-65f0297a899d","2026-10-31","haare-abend",0,"2026-10-31T21:50:16.580643+00:00",false],
 ["a825dac2-5de3-4d01-8476-59ceedd35455","2026-10-31","trockenfutter",0,"2026-10-31T21:50:26.747014+00:00",false],
 ["c7da4444-254b-4bc7-8de1-f7bb19436bc5","2026-10-31","tagesabschluss",0,"2026-10-31T21:50:43.280729+00:00",false],
 ["7ab7a268-74f9-4c0b-a506-cbd631bc7aa0","2026-10-30","zaehne-morgen",0,"2026-11-01T13:55:27.828301+00:00",false],
 ["5a57513b-ac70-4f0e-97c3-7670bf56c3cc","2026-10-30","haare-morgen",0,"2026-11-01T13:55:41.731995+00:00",false],
 ["62259ca9-6f8f-4622-99d5-b0836f6d7e9e","2026-11-01","zaehne-morgen",0,"2026-11-01T18:32:51.959087+00:00",false],
 ["c3557081-b2cc-444b-8634-f11e51668924","2026-11-01","haare-morgen",0,"2026-11-01T18:32:53.890885+00:00",false],
 ["a530af87-f263-4e89-b367-e99883e4bb95","2026-11-01","haarewaschen",1,"2026-11-01T20:23:54.127563+00:00",true],
 ["a35d976f-82f3-4c91-9d6a-b0a1068a7035","2026-11-01","trockenfutter",0,"2026-11-01T20:24:26.82097+00:00",false],
 ["55ab0b50-da99-4c8a-b2cc-c7eecd1aaf82","2026-11-01","haare-abend",0,"2026-11-01T20:27:26.402805+00:00",false],
 ["18b06d29-84f9-409e-8275-cbf012d65f85","2026-11-01","zaehne-abend",0,"2026-11-01T20:36:34.458914+00:00",false],
 ["0e8b34fb-696c-45fb-bc74-48b061481e3d","2026-11-01","kleider-bereitlegen",0,"2026-11-01T20:51:11.032911+00:00",false],
 ["11c6a45c-ecd9-43b5-9481-cba6a76a345f","2026-11-01","rucksack",0,"2026-11-01T20:55:22.089948+00:00",false],
 ["52fceb5a-3701-45c0-bd80-3d1731e88675","2026-11-01","tagesabschluss",0,"2026-11-01T20:55:41.173512+00:00",false],
 ["0b645935-b8f2-4bef-bfe5-de6db1dbae48","2026-11-02","zaehne-morgen",0,"2026-11-02T06:45:44.790528+00:00",false],
 ["a3c19628-c501-4d49-9ce4-72b748d0eaae","2026-11-02","haare-morgen",0,"2026-11-02T06:48:23.122793+00:00",false],
 ["3ff80776-b8f7-4a0c-b75f-bd6ff068569b","2026-11-02","rucksack-auspacken",0,"2026-11-02T20:31:07.747205+00:00",false],
 ["34ea6427-a356-4012-a6fc-ba495e7ca877","2026-11-02","kleider-bereitlegen",0,"2026-11-02T20:31:18.7009+00:00",false],
 ["7cbaf6e2-ed4e-44f3-85f1-fd7d9ec1a72f","2026-11-02","zaehne-abend",0,"2026-11-02T20:31:20.254387+00:00",false],
 ["a19692f1-4125-4d24-91b8-c0945ae6a10c","2026-11-02","haare-abend",0,"2026-11-02T20:31:23.084396+00:00",false],
 ["c0b656e0-418c-434f-9d6e-a6be4054d721","2026-11-02","trockenfutter",0,"2026-11-02T20:31:30.40719+00:00",false],
 ["0718a596-3234-4bdf-b1ef-7afc89721bb3","2026-11-02","buch-lesen",0,"2026-11-02T20:31:38.268906+00:00",false],
 ["53e4f6fe-94cb-4bf3-895b-9213fd7ce200","2026-11-02","rucksack",0,"2026-11-02T20:38:12.938234+00:00",false],
 ["7bd0287a-7c33-4d3f-98b1-d11c53ca4284","2026-11-02","kleider-zusammenlegen",0,"2026-11-02T20:39:05.888472+00:00",false],
 ["9d9dac10-b1cd-401a-80bf-aefe49505337","2026-11-02","tagesabschluss",0,"2026-11-02T20:39:06.173685+00:00",false],
 ["f36f165d-729c-4055-addc-c36d157c4fdb","2026-11-03","zaehne-morgen",0,"2026-11-03T20:43:05.493791+00:00",false],
 ["d164cabb-fbd7-4dce-923b-4fc3b3c95908","2026-11-03","haare-morgen",0,"2026-11-03T20:43:12.729609+00:00",false],
 ["e0ceb4e8-d220-4d21-98fc-8330db0cd915","2026-11-03","rucksack-auspacken",0,"2026-11-03T20:44:10.182184+00:00",false],
 ["6a9cd6f0-672f-4dc1-b070-8f2681557224","2026-11-03","haare-abend",0,"2026-11-03T20:44:25.325195+00:00",false],
 ["a6d8b89a-7c3e-48ec-b6fc-cf2d939b0ae3","2026-11-03","trockenfutter",0,"2026-11-03T20:44:31.25989+00:00",false],
 ["c4ca1d09-b1c5-438c-830d-d8c0ee8bf2c7","2026-11-03","kleider-bereitlegen",0,"2026-11-03T20:46:58.579178+00:00",false],
 ["95911ad6-7bd0-4204-bdb3-751435ff0c20","2026-11-03","rucksack",0,"2026-11-03T20:48:04.000695+00:00",false],
 ["cdddd7da-559c-44c8-9b5b-0260b4f9d445","2026-11-03","zaehne-abend",0,"2026-11-03T22:08:06.936915+00:00",false]
]'::jsonb) e
on conflict do nothing;

alter table public.task_completions enable trigger trg_completion_stars;
