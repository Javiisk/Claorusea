import os
import discord
from discord import app_commands
from discord.ext import commands

intents = discord.Intents.default()
bot = commands.Bot(command_prefix="/", intents=intents)

@bot.event
async def on_ready():
    await bot.tree.sync()
    print(f"Bot conectado como {bot.user}")

@bot.tree.command(name="say", description="El bot repite lo que escribas")
@app_commands.describe(mensaje="Lo que querés que diga el bot")
async def say(interaction: discord.Interaction, mensaje: str):
    await interaction.response.send_message(mensaje)

TOKEN = os.environ["DISCORD_TOKEN"]
bot.run(TOKEN)
