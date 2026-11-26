#!/usr/bin/env bash
# Publicação do pacote VERITAS da Fase 0a do negociador, DESLIGADO (envs novas ausentes ou vazias).
# Pacote: branch vicenzzopalma/negociador-fase0a-veritas, 265a0ea..d86af54, 9 arquivos de backend/src.
#
#   publicar.sh --seco            confere tudo e grava o retrato; NÃO mexe no backend, no pm2 nem no .env
#   publicar.sh                   publica (agendado pelo systemd-run para 21:10 UTC)
#   publicar.sh --rollback <dir>  volta os arquivos do backup <dir> e reinicia o veritas-backend
#
# Só reinicia o processo pm2 "veritas-backend". Nunca encerra outro processo.
set -u
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export HOME=/root

ST=/opt/pafixa/staging/veritas-fase0a-20261126
BE=/var/www/VERITAS/backend
APP=veritas-backend
SAUDE=http://127.0.0.1:6002/health
ESPERA_SUBIR_S=180
ENVS="RETORNO_IA_ARQUIVO_CONEXOES RETORNO_IA_LID_CONEXOES RETORNO_IA_SESSAO_CONEXOES VERITAS_LID_CONFLITO_TRAVA RETORNO_IA_TRAVA_ARQUIVADAS"

MODO=real
[ "${1:-}" = "--seco" ] && MODO=seco
[ "${1:-}" = "--rollback" ] && MODO=rollback

TS=$(date -u +%Y%m%d-%H%M%S)
case $MODO in
  seco) OUT=/opt/pafixa/backups/veritas-fase0a-seco-$TS ;;
  rollback) OUT=${2:?"uso: publicar.sh --rollback <dir do backup>"} ;;
  *) OUT=/opt/pafixa/backups/veritas-fase0a-$TS ;;
esac
mkdir -p "$OUT"
LOG=$OUT/execucao.log
REL=$OUT/relatorio.txt

log() { echo "$(date -u +%FT%TZ) [$MODO] $*" | tee -a "$LOG"; }

# Uma execução por vez.
exec 9>/run/veritas-fase0a-publicar.lock
if ! flock -n 9; then
  log "outra execução em andamento; saindo sem fazer nada"
  exit 3
fi

abortar() {
  log "ABORTADO: $*"
  { echo "resultado: ABORTADO (nada foi alterado)"; echo "motivo: $*"; } >> "$REL"
  exit 2
}

saude() { curl -s -o /dev/null -m 3 -w "%{http_code}" "$SAUDE" 2>/dev/null; }

pm2_estado() {
  pm2 jlist 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", d => (s += d)).on("end", () => {
      try { for (const p of JSON.parse(s)) console.log([p.name, p.pm2_env.status, "restarts=" + p.pm2_env.restart_time, "pid=" + p.pid].join("\t")); }
      catch (e) { console.log("ERRO pm2 jlist"); }
    });'
}

retrato() { # $1 = arquivo de saída
  node "$ST/retrato.js" "$BE" > "$1" 2>> "$LOG" || log "retrato falhou ($1)"
}

conectadas() { awk -F'\t' '$2 == "CONNECTED"' "$1" 2>/dev/null | wc -l; }

esperar_subir() { # espera o /health responder 200; 0 = subiu
  local ini=$SECONDS
  while [ $((SECONDS - ini)) -lt $ESPERA_SUBIR_S ]; do
    [ "$(saude)" = "200" ] && { log "backend respondeu /health 200 em $((SECONDS - ini)) s"; return 0; }
    sleep 5
  done
  return 1
}

restaurar_arquivos() { # $1 = dir do backup
  local dir=$1 rel novo base ok=0
  while IFS=$'\t' read -r rel novo base; do
    if [ "$base" = "NOVO" ]; then
      rm -f "$BE/$rel"
      [ -e "$BE/$rel" ] && { log "não removeu $rel"; ok=1; }
    else
      install -m 0644 "$dir/arquivos/$rel" "$BE/$rel"
      [ "$(sha256sum "$BE/$rel" | cut -c1-64)" = "$base" ] || { log "sha da base não voltou em $rel"; ok=1; }
    fi
  done < "$ST/manifesto.tsv"
  rmdir "$BE/src/services/RetornoIaServices" 2>/dev/null
  return $ok
}

if [ "$MODO" = "rollback" ]; then
  [ -d "$OUT/arquivos" ] || { log "backup sem a pasta arquivos: $OUT"; exit 2; }
  log "rollback manual a partir de $OUT"
  restaurar_arquivos "$OUT" && log "arquivos da base restaurados (sha conferido)"
  pm2 restart "$APP" >> "$LOG" 2>&1
  esperar_subir || log "ATENÇÃO: backend não respondeu em ${ESPERA_SUBIR_S}s após o rollback"
  echo "rollback manual em $(date -u +%FT%TZ)" >> "$REL"
  exit 0
fi

log "início; staging $ST; saída $OUT"

# 1. Conferências (nos dois modos). Qualquer falha aborta sem tocar em nada.
node "$ST/checa_build.js" "$ST" "$BE" >> "$LOG" 2>&1 || abortar "build do staging não confere (ver execucao.log)"
log "build do staging conferido (sha, transpilação, imports)"

while IFS=$'\t' read -r rel novo base; do
  if [ "$base" = "NOVO" ]; then
    [ -e "$BE/$rel" ] && abortar "arquivo novo já existe no backend: $rel"
  else
    atual=$(sha256sum "$BE/$rel" 2>/dev/null | cut -c1-64)
    [ "$atual" = "$novo" ] && abortar "pacote parece já publicado: $rel"
    [ "$atual" = "$base" ] || abortar "backend vivo diferente da base esperada: $rel"
  fi
done < "$ST/manifesto.tsv"
log "backend vivo igual à base 265a0ea nos 5 arquivos alterados; 4 novos ausentes"

for k in $ENVS; do
  linha=$(grep -E "^[[:space:]]*(export[[:space:]]+)?$k=" "$BE/.env" 2>/dev/null | tail -1)
  v=${linha#*=}; v=$(printf '%s' "$v" | tr -d "\"' \r\t")
  [ -n "$linha" ] && [ -n "$v" ] && abortar "env $k preenchida no .env"
  noPm2=$(pm2 jlist 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const p=JSON.parse(s).find(x=>x.name==='$APP');const v=p&&(p.pm2_env['$k']||(p.pm2_env.env||{})['$k']);console.log(v?'PREENCHIDA':'vazia')}catch(e){console.log('ERRO')}})")
  [ "$noPm2" = "vazia" ] || abortar "env $k no ambiente do pm2: $noPm2"
done
log "as 5 envs novas estão ausentes ou vazias (.env e ambiente do pm2); valores não lidos no log"

pm2_estado > "$OUT/pm2-antes.txt"
grep -qP "^$APP\tonline" "$OUT/pm2-antes.txt" || abortar "$APP não está online antes da publicação"
[ "$(saude)" = "200" ] || abortar "backend não responde /health antes da publicação"
log "$APP online e /health 200 antes"

# 2. Retrato antes.
retrato "$OUT/whatsapps-antes.tsv"
( cd "$BE" && while IFS=$'\t' read -r rel _ _; do
    [ -e "$rel" ] && sha256sum "$rel" || echo "ausente  $rel"
  done < "$ST/manifesto.tsv" ) > "$OUT/sha-antes.txt"
ANTES=$(conectadas "$OUT/whatsapps-antes.tsv")
TOTAL=$(wc -l < "$OUT/whatsapps-antes.tsv")
log "retrato antes: $ANTES CONNECTED de $TOTAL conexões"

if [ "$MODO" = "seco" ]; then
  {
    echo "resultado: SECO OK (nada foi alterado: sem backup, sem cópia, sem restart)"
    echo "conexoes: $TOTAL; CONNECTED agora: $ANTES"
    echo "publicaria: $(wc -l < "$ST/manifesto.tsv") arquivos; envs novas ausentes ou vazias"
  } >> "$REL"
  log "modo seco concluído; nada alterado"
  exit 0
fi

# 3. Backup do src e do dist atuais (e dos 5 arquivos, para o rollback exato).
tar -C "$BE" -czf "$OUT/src-antes.tgz" src || abortar "backup do src falhou"
if [ -d "$BE/dist" ]; then tar -C "$BE" -czf "$OUT/dist-antes.tgz" dist || abortar "backup do dist falhou"; fi
while IFS=$'\t' read -r rel novo base; do
  [ "$base" = "NOVO" ] && continue
  install -D -m 0644 "$BE/$rel" "$OUT/arquivos/$rel" || abortar "cópia de segurança de $rel falhou"
done < "$ST/manifesto.tsv"
cp "$ST/manifesto.tsv" "$OUT/manifesto.tsv"
log "backup gravado (src-antes.tgz, dist-antes.tgz, arquivos/)"

# 4. Cópia do pacote.
COPIA_OK=1
while IFS=$'\t' read -r rel novo base; do
  install -D -m 0644 "$ST/backend/$rel" "$BE/$rel" || COPIA_OK=0
  [ "$(sha256sum "$BE/$rel" | cut -c1-64)" = "$novo" ] || { log "sha não confere após cópia: $rel"; COPIA_OK=0; }
done < "$ST/manifesto.tsv"
if [ $COPIA_OK -ne 1 ]; then
  log "cópia incompleta; restaurando sem reiniciar"
  restaurar_arquivos "$OUT"
  { echo "resultado: ABORTADO NA CÓPIA (arquivos restaurados, sem restart)"; } >> "$REL"
  exit 2
fi
log "9 arquivos copiados e conferidos"

# 5. Restart e espera.
T0=$SECONDS
pm2 restart "$APP" >> "$LOG" 2>&1
log "pm2 restart $APP disparado"
RESULTADO="PUBLICADO"
if ! esperar_subir; then
  log "backend NÃO respondeu em ${ESPERA_SUBIR_S}s: rollback automático"
  restaurar_arquivos "$OUT" && log "arquivos da base restaurados (sha conferido)"
  pm2 restart "$APP" >> "$LOG" 2>&1
  if esperar_subir; then RESULTADO="ROLLBACK (backend voltou com a base)"; else RESULTADO="ROLLBACK SEM RESPOSTA DO BACKEND (verificar)"; fi
  T0=$SECONDS
fi
pm2_estado > "$OUT/pm2-depois.txt"

# 6. Retratos aos 2, 5 e 15 min do restart.
for min in 2 5 15; do
  falta=$(( T0 + min * 60 - SECONDS ))
  [ $falta -gt 0 ] && sleep $falta
  retrato "$OUT/whatsapps-depois-${min}min.tsv"
  log "retrato ${min} min: $(conectadas "$OUT/whatsapps-depois-${min}min.tsv") CONNECTED; /health $(saude)"
done

# 7. Relatório só de contagens e ids.
{
  echo "resultado: $RESULTADO"
  echo "inicio: $TS UTC; pacote 265a0ea..d86af54 (9 arquivos), envs novas ausentes ou vazias"
  echo "conexoes: $TOTAL"
  echo "CONNECTED antes: $ANTES"
  for min in 2 5 15; do echo "CONNECTED depois ${min} min: $(conectadas "$OUT/whatsapps-depois-${min}min.tsv")"; done
  echo "/health no fim: $(saude)"
  echo "ids que mudaram de estado (antes -> 15 min):"
  awk -F'\t' 'NR==FNR { a[$1] = $2; next } { if (($1 in a) && a[$1] != $2) print "  " $1 ": " a[$1] " -> " $2; else if (!($1 in a)) print "  " $1 ": (novo) -> " $2 }' \
    "$OUT/whatsapps-antes.tsv" "$OUT/whatsapps-depois-15min.tsv"
  echo "rollback manual, se preciso: bash $ST/publicar.sh --rollback $OUT"
} >> "$REL"
log "fim: $RESULTADO; relatório em $REL"
exit 0
