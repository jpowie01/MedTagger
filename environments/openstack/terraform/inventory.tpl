[app_hosts]
ansible_host=${app_host_ip} ansible_user=${default_user} ansible_ssh_private_key_file=${app_key_name}

[db_hosts]
ansible_host=${db_host_ip} ansible_user=${default_user} ansible_ssh_private_key_file=${db_key_name}

[db_hosts:vars]
ansible_ssh_common_args='-o ProxyCommand="ssh -i ${app_key_name} -W %h:%p ${default_user}@${app_host_ip}"'