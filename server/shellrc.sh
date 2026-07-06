# rcfile for terminal-bridge sessions. Kept minimal and exam-like:
# the real exam gives you bash with kubectl completion and a k alias.
[ -f /etc/bash.bashrc ] && source /etc/bash.bashrc

export PS1='\[\e[32m\]student@cka\[\e[0m\]:\[\e[34m\]\w\[\e[0m\]\$ '

if command -v kubectl >/dev/null 2>&1; then
  source <(kubectl completion bash)
  alias k=kubectl
  complete -o default -F __start_kubectl k
fi
