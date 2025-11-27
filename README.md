## space fox

personal kitchen sink bot | [invite](https://discord.com/oauth2/authorize?client_id=635446525639786498) with no guarantee it'll actually be up

note: readme not actively kept up to date

## features

### bangs

quickly look up information with syntax you might be familiar with from your search engine. at the end of messages for chat, or both at the start and at the end as a slash command

<img height="300" alt="output of 'object.entries !mdn', with information from the mozilla developer network" 
  src="https://github.com/user-attachments/assets/a63967c6-47dc-4b9b-b8ce-9478ee3a5515" />
<img height="300" alt="list of all bangs" src="https://github.com/user-attachments/assets/7b3f3b09-d385-4f85-bf5a-2f4b9fb17149" />

### reminders

recall something later, with support for saving your timezone, and that allows for selecting a message to specifically check it later

<img height="150" alt="image" src="https://github.com/user-attachments/assets/1709d3da-aa6a-4429-8335-463eaf88222b" />
<img height="150" alt="image" src="https://github.com/user-attachments/assets/6cfdbb88-4437-49c8-9f3f-83d8a2a3a1e3" />

<img height="86" alt="image" src="https://github.com/user-attachments/assets/479bcf5d-d821-46dd-a7e2-2e2677031b88" />

### pinboard

a special place to save messages for later and easily search through them

<img height="300" alt="image" src="https://github.com/user-attachments/assets/5905bb19-ca9b-4a7d-8ea1-53f0a04d42df" />

<img height="100" alt="image" src="https://github.com/user-attachments/assets/42516ac7-00af-49da-b87f-853c57082db4" />

## self hosting

0. install node, pnpm and probably git
1. download/clone the repository
2. rename the `.env.example` file to `.env` and add appropriate values
3. (optional) create a `./permissions.json` or `./data/permissions.json` file for access to gatekept features
```json
{
    "me": {
        "users": [],
        "guilds": []
    },
    "friends": {
        "users": [],
        "guilds": []
    }
}
```
4.

```sh
pnpm i
```
5. 

```sh
pnpm registerCommands
```
note that this will override any commands if you're using an existing bot

6.

```sh
pnpm start
```
7. create a `./data` folder and any missing data storage files in it
   
   <sub>i'll come up with a better database than json eventually :clueless:</sub>
