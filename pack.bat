@echo off
chcp 65001 > nul
type index.html css\style.css js\config.js js\state.js js\audio.js js\world.js js\viewmodel.js js\hud.js js\combat.js js\bots.js js\spectator.js js\controls.js js\main.js > _all_code.txt
echo Готово! Файл _all_code.txt обновлен.